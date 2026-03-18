import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQuery } from './dto/list-reservations.dto';
import { AvailabilityService } from '../availability/availability.service';
import { ServicesService } from '../services/services.service';

const ACTIVE_STATUSES = [ReservationStatus.CONFIRMED, ReservationStatus.PENDING];

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AvailabilityService))
    private readonly availabilityService: AvailabilityService,
    private readonly servicesService: ServicesService,
  ) {}

  /**
   * Crea una reserva de forma atómica y segura contra condiciones de carrera.
   * Usa pg_advisory_xact_lock para serializar acceso concurrente al mismo slot.
   */
  async create(dto: CreateReservationDto): Promise<Reservation> {
    await this.servicesService.findOne(dto.service_id);

    let slotStartDt: DateTime;
    try {
      slotStartDt = DateTime.fromISO(dto.slot_start, { setZone: true });
      if (!slotStartDt.isValid) throw new Error('Invalid');
    } catch {
      throw new BadRequestException(`slot_start inválido: ${dto.slot_start}`);
    }

    const slotStartUtc = slotStartDt.toUTC().toJSDate();

    const slotInfo = await this.availabilityService.validateSlotForReservation(
      dto.service_id,
      slotStartUtc,
    );

    if (!slotInfo) {
      throw new BadRequestException(
        `El bloque ${dto.slot_start} no existe o no está habilitado para el servicio ${dto.service_id}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Advisory lock a nivel de transacción: serializa acceso concurrente al mismo slot
      const lockKey = `${dto.service_id}|${slotStartUtc.toISOString()}`;
      await manager.query(
        `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`,
        [lockKey],
      );

      const activeCount = await manager
        .getRepository(Reservation)
        .createQueryBuilder('r')
        .where('r.service_id = :serviceId', { serviceId: dto.service_id })
        .andWhere('r.slot_start = :slotStart', { slotStart: slotStartUtc })
        .andWhere('r.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
        .getCount();

      const available = slotInfo.capacity - activeCount;

      if (available <= 0) {
        throw new ConflictException(
          `Sin cupos disponibles para ${dto.slot_start}. Capacidad: ${slotInfo.capacity}, Reservadas: ${activeCount}`,
        );
      }

      const memberId: string | null =
        typeof dto.metadata?.member_id === 'string' ? dto.metadata.member_id : null;
      const reservation = manager.getRepository(Reservation).create({
        serviceId: dto.service_id,
        slotStart: slotStartUtc,
        slotEnd: slotInfo.slotEnd,
        status: ReservationStatus.CONFIRMED,
        customerName: dto.customer_name ?? null,
        customerExternalId: dto.customer_external_id ?? null,
        memberId,
        metadata: dto.metadata ?? null,
      });

      return manager.getRepository(Reservation).save(reservation);
    });
  }

  async cancel(reservationId: number): Promise<Reservation> {
    const reservation = await this.findOne(reservationId);

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException(`La reserva ${reservationId} ya está cancelada`);
    }

    reservation.status = ReservationStatus.CANCELLED;
    return this.reservationRepo.save(reservation);
  }

  async findAll(query: ListReservationsQuery): Promise<Reservation[]> {
    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .orderBy('r.slot_start', 'ASC');

    if (query.service_id) {
      qb.andWhere('r.service_id = :serviceId', { serviceId: query.service_id });
    }

    if (query.date) {
      const timezone = query.service_id
        ? (await this.servicesService.findOne(query.service_id)).timezone
        : 'UTC';
      const startOfDay = DateTime.fromISO(query.date, { zone: timezone })
        .startOf('day')
        .toUTC()
        .toJSDate();
      const endOfDay = DateTime.fromISO(query.date, { zone: timezone })
        .endOf('day')
        .toUTC()
        .toJSDate();

      qb.andWhere('r.slot_start >= :startOfDay', { startOfDay })
        .andWhere('r.slot_start <= :endOfDay', { endOfDay });
    }

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });
    if (!reservation) {
      throw new NotFoundException(`Reserva con id ${id} no encontrada`);
    }
    return reservation;
  }

  async findByMemberId(memberId: string): Promise<Reservation[]> {
    return this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.service', 's')
      .where('r.member_id = :memberId', { memberId })
      .orderBy('r.slot_start', 'DESC')
      .getMany();
  }
}

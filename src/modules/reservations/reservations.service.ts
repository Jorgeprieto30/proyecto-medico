import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
   * Crea una reserva con cupo numerado.
   * Usa pg_advisory_xact_lock para serializar acceso concurrente al mismo cupo/slot.
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

    // Validar spot_number si viene explícito
    if (dto.spot_number != null && (dto.spot_number < 1 || dto.spot_number > slotInfo.capacity)) {
      throw new BadRequestException(
        `Cupo ${dto.spot_number} inválido. Rango permitido: 1–${slotInfo.capacity}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      let spotNumber: number;

      if (dto.spot_number != null) {
        // ── Cupo específico elegido por el cliente ─────────────────────────
        const lockKey = `${dto.service_id}|${slotStartUtc.toISOString()}|${dto.spot_number}`;
        await manager.query(
          `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`,
          [lockKey],
        );

        const existingSpot = await manager.getRepository(Reservation).findOne({
          where: {
            serviceId: dto.service_id,
            slotStart: slotStartUtc,
            spotNumber: dto.spot_number,
            status: In(ACTIVE_STATUSES),
          },
        });

        if (existingSpot) {
          throw new ConflictException(
            `El cupo ${dto.spot_number} ya está ocupado para el horario ${dto.slot_start}`,
          );
        }

        spotNumber = dto.spot_number;
      } else {
        // ── Auto-asignación: lock a nivel de slot completo ─────────────────
        const slotLockKey = `${dto.service_id}|${slotStartUtc.toISOString()}`;
        await manager.query(
          `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`,
          [slotLockKey],
        );

        const takenSpots = await manager.getRepository(Reservation).find({
          where: {
            serviceId: dto.service_id,
            slotStart: slotStartUtc,
            status: In(ACTIVE_STATUSES),
          },
          select: ['spotNumber'],
        });

        const takenSet = new Set(takenSpots.map((r) => r.spotNumber));
        const available = Array.from({ length: slotInfo.capacity }, (_, i) => i + 1)
          .find((n) => !takenSet.has(n));

        if (available == null) {
          throw new ConflictException(`No hay cupos disponibles para el horario ${dto.slot_start}`);
        }

        spotNumber = available;
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
        spotNumber,
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

  async cancelByMember(reservationId: number, memberId: string): Promise<Reservation> {
    const reservation = await this.findOne(reservationId);
    if (reservation.memberId !== memberId) {
      throw new NotFoundException(`Reserva con id ${reservationId} no encontrada`);
    }
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

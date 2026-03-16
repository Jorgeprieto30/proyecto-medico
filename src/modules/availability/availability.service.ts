import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { ServicesService } from '../services/services.service';
import { ScheduleRulesService } from '../schedule-rules/schedule-rules.service';
import { ScheduleBlocksService } from '../schedule-blocks/schedule-blocks.service';
import { ExceptionsService } from '../exceptions/exceptions.service';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationStatus } from '../reservations/entities/reservation.entity';
import { SlotAvailabilityDto, SlotDetailDto } from './dto/availability.dto';
import { ScheduleRule } from '../schedule-rules/entities/schedule-rule.entity';
import { ScheduleBlock } from '../schedule-blocks/entities/schedule-block.entity';
import { ServiceException } from '../exceptions/entities/service-exception.entity';

interface RawSlot {
  slotStart: DateTime;
  slotEnd: DateTime;
  capacity: number;
}

/** Normaliza tiempos de la BD (que vienen como 'HH:MM:SS') a 'HH:MM' */
function normalizeTime(t: string | null): string | null {
  if (!t) return null;
  return t.substring(0, 5); // '08:00:00' → '08:00'
}

/**
 * Estados que consumen cupo.
 * - confirmed: siempre consume
 * - pending: consume temporalmente (evita que otro reserve mientras está pendiente)
 * - cancelled: NO consume
 */
const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.PENDING,
];

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly servicesService: ServicesService,
    private readonly rulesService: ScheduleRulesService,
    private readonly blocksService: ScheduleBlocksService,
    private readonly exceptionsService: ExceptionsService,
  ) {}

  /**
   * Consulta disponibilidad completa de un día.
   * Retorna todos los bloques válidos con su ocupación.
   */
  async getAvailabilityByDate(
    serviceId: string,
    date: string,
  ): Promise<SlotAvailabilityDto[]> {
    const service = await this.servicesService.findOne(serviceId);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date debe tener formato YYYY-MM-DD');
    }

    const slots = await this.generateSlots(serviceId, date, service.timezone, service.slotDurationMinutes);

    if (slots.length === 0) {
      return [];
    }

    const reservationCounts = await this.getReservationCountsBySlots(
      serviceId,
      slots.map((s) => s.slotStart),
    );

    return slots.map((slot) => {
      const key = slot.slotStart.toISO()!;
      const reserved = reservationCounts[key] ?? 0;
      const available = Math.max(0, slot.capacity - reserved);
      return {
        slot_start: slot.slotStart.toISO()!,
        slot_end: slot.slotEnd.toISO()!,
        capacity: slot.capacity,
        reserved,
        available,
        bookable: available > 0,
      };
    });
  }

  /**
   * Consulta disponibilidad de un bloque puntual.
   */
  async getAvailabilityBySlot(
    serviceId: string,
    datetimeStr: string,
  ): Promise<SlotDetailDto> {
    const service = await this.servicesService.findOne(serviceId);

    // Parsear el datetime con la zona horaria del servicio como fallback
    let requestedDt: DateTime;
    try {
      requestedDt = DateTime.fromISO(datetimeStr, { setZone: true });
      if (!requestedDt.isValid) throw new Error('Invalid');
    } catch {
      throw new BadRequestException(`datetime inválido: ${datetimeStr}`);
    }

    // Convertir al timezone del servicio para determinar la fecha local
    const localDt = requestedDt.setZone(service.timezone);
    const date = localDt.toISODate()!;

    const slots = await this.generateSlots(serviceId, date, service.timezone, service.slotDurationMinutes);

    // Buscar el slot que coincide con el datetime solicitado
    const matchingSlot = slots.find((s) => {
      return s.slotStart.toMillis() === requestedDt.toMillis() ||
        s.slotStart.setZone(requestedDt.zoneName!).toISO() === requestedDt.toISO();
    });

    if (!matchingSlot) {
      return {
        slot_start: requestedDt.toISO()!,
        slot_end: requestedDt.plus({ minutes: service.slotDurationMinutes }).toISO()!,
        capacity: 0,
        reserved: 0,
        available: 0,
        bookable: false,
        exists: false,
      };
    }

    const counts = await this.getReservationCountsBySlots(serviceId, [matchingSlot.slotStart]);
    const reserved = counts[matchingSlot.slotStart.toISO()!] ?? 0;
    const available = Math.max(0, matchingSlot.capacity - reserved);

    return {
      slot_start: matchingSlot.slotStart.toISO()!,
      slot_end: matchingSlot.slotEnd.toISO()!,
      capacity: matchingSlot.capacity,
      reserved,
      available,
      bookable: available > 0,
      exists: true,
    };
  }

  /**
   * Genera los slots válidos para una fecha.
   * Aplica: reglas semanales → excepciones → bloques de capacidad.
   */
  async generateSlots(
    serviceId: string,
    date: string,
    timezone: string,
    slotDurationMinutes: number,
  ): Promise<RawSlot[]> {
    // 1. Determinar día de semana ISO (1=Lunes, 7=Domingo)
    const localDate = DateTime.fromISO(date, { zone: timezone });
    if (!localDate.isValid) {
      throw new BadRequestException(`Fecha inválida: ${date}`);
    }
    const dayOfWeek = localDate.weekday; // Luxon: 1=Lunes, 7=Domingo

    // 2. Cargar reglas activas para este día y filtrar por rango de vigencia
    const allRules = await this.rulesService.findActiveByServiceAndDay(serviceId, dayOfWeek);
    const rules = allRules.filter((r) => {
      if (r.validFrom && date < r.validFrom) return false;
      if (r.validUntil && date > r.validUntil) return false;
      return true;
    });

    // 3. Cargar excepciones de la fecha
    const exceptions = await this.exceptionsService.findByServiceAndDate(serviceId, date);

    // 4. Verificar cierre total del día (excepción sin tramo horario y is_closed=true)
    const dayClosedException = exceptions.find(
      (e) => e.isClosed && !e.startTime && !e.endTime,
    );
    if (dayClosedException) {
      return []; // Día cerrado completamente
    }

    // 5. Si no hay reglas activas, no hay disponibilidad
    if (rules.length === 0) {
      return [];
    }

    // 6. Cargar bloques activos para este día
    const blocks = await this.blocksService.findActiveByServiceAndDay(serviceId, dayOfWeek);

    // 7. Generar slots para cada regla
    const allSlots: RawSlot[] = [];

    for (const rule of rules) {
      const ruleSlots = this.generateSlotsForRule(
        rule,
        blocks,
        exceptions,
        localDate,
        timezone,
        slotDurationMinutes,
      );
      allSlots.push(...ruleSlots);
    }

    // Ordenar por hora de inicio
    allSlots.sort((a, b) => a.slotStart.toMillis() - b.slotStart.toMillis());

    return allSlots;
  }

  /**
   * Genera slots dentro de una regla semanal, aplicando excepciones y capacidad de bloques.
   */
  private generateSlotsForRule(
    rule: ScheduleRule,
    blocks: ScheduleBlock[],
    exceptions: ServiceException[],
    localDate: DateTime,
    timezone: string,
    slotDurationMinutes: number,
  ): RawSlot[] {
    const slots: RawSlot[] = [];

    // Obtener el rango efectivo del día (puede ser modificado por una excepción de rango)
    // Normalizar: la BD devuelve TIME como 'HH:MM:SS', necesitamos 'HH:MM'
    let dayStartTime = normalizeTime(rule.startTime)!;
    let dayEndTime = normalizeTime(rule.endTime)!;

    // Excepción de cambio de horario del día completo (is_closed=false, sin tramo, con start/end_time)
    const dayRangeOverride = exceptions.find(
      (e) => !e.isClosed && !e.startTime && !e.endTime && e.capacityOverride === null && e.reason,
    );
    // En realidad, para cambiar el horario del día, la excepción tendría start_time y end_time
    // como nuevo horario. Si is_closed=false y no tiene tramo específico, es un override del día.
    // Detectamos excepción de rango de día: is_closed=false, y startTime/endTime definen el nuevo rango
    const dayOverrideException = exceptions.find(
      (e) => !e.isClosed && e.startTime && e.endTime && !this.isSlotException(e),
    );
    if (dayOverrideException) {
      dayStartTime = normalizeTime(dayOverrideException.startTime)!;
      dayEndTime = normalizeTime(dayOverrideException.endTime)!;
    }

    // Convertir las horas a DateTime en la zona local del servicio
    const [startH, startM] = dayStartTime.split(':').map(Number);
    const [endH, endM] = dayEndTime.split(':').map(Number);

    let current = localDate.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
    const dayEnd = localDate.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

    while (current < dayEnd) {
      const slotEnd = current.plus({ minutes: slotDurationMinutes });

      // No generar un slot que sobrepase el fin del día
      if (slotEnd > dayEnd) break;

      const slotStartTime = current.toFormat('HH:mm');
      const slotEndTime = slotEnd.toFormat('HH:mm');

      // Verificar si el slot está cerrado por excepción
      const closedException = this.findClosingException(exceptions, slotStartTime, slotEndTime);
      if (closedException) {
        current = slotEnd;
        continue;
      }

      // Buscar capacidad: primero en excepciones, luego en bloques
      const capacityFromException = this.findCapacityOverride(exceptions, slotStartTime, slotEndTime);

      let capacity: number | null = capacityFromException;

      if (capacity === null) {
        // Buscar en bloques configurados
        const matchingBlock = this.findMatchingBlock(blocks, slotStartTime, slotEndTime);
        capacity = matchingBlock ? matchingBlock.capacity : null;
      }

      // Solo agregar el slot si tiene capacidad configurada
      if (capacity !== null && capacity > 0) {
        slots.push({
          slotStart: current,
          slotEnd,
          capacity,
        });
      }

      current = slotEnd;
    }

    return slots;
  }

  /**
   * Determina si una excepción aplica como "cierre" para un tramo específico.
   */
  private findClosingException(
    exceptions: ServiceException[],
    slotStartTime: string,
    slotEndTime: string,
  ): ServiceException | undefined {
    return exceptions.find((e) => {
      if (!e.isClosed) return false;
      if (!e.startTime || !e.endTime) return false;
      const eStart = normalizeTime(e.startTime)!;
      const eEnd = normalizeTime(e.endTime)!;
      return eStart <= slotStartTime && eEnd >= slotEndTime;
    });
  }

  /**
   * Busca capacidad override en las excepciones para un tramo específico.
   */
  private findCapacityOverride(
    exceptions: ServiceException[],
    slotStartTime: string,
    slotEndTime: string,
  ): number | null {
    const override = exceptions.find((e) => {
      if (e.isClosed) return false;
      if (e.capacityOverride === null) return false;
      if (!e.startTime || !e.endTime) return false;
      const eStart = normalizeTime(e.startTime)!;
      const eEnd = normalizeTime(e.endTime)!;
      return eStart <= slotStartTime && eEnd >= slotEndTime;
    });
    return override?.capacityOverride ?? null;
  }

  /**
   * Indica si una excepción tiene tramo horario específico (vs día completo).
   */
  private isSlotException(exception: ServiceException): boolean {
    return !!(exception.startTime && exception.endTime);
  }

  /**
   * Encuentra el bloque configurado que contiene un slot específico.
   */
  private findMatchingBlock(
    blocks: ScheduleBlock[],
    slotStartTime: string,
    slotEndTime: string,
  ): ScheduleBlock | undefined {
    return blocks.find((b) => {
      const bStart = normalizeTime(b.startTime)!;
      const bEnd = normalizeTime(b.endTime)!;
      return bStart <= slotStartTime && bEnd >= slotEndTime;
    });
  }

  /**
   * Cuenta reservas activas agrupadas por slot_start.
   * Retorna un mapa { slot_start_iso: count }
   */
  private async getReservationCountsBySlots(
    serviceId: string,
    slotStarts: DateTime[],
  ): Promise<Record<string, number>> {
    if (slotStarts.length === 0) return {};

    const slotStartsUtc = slotStarts.map((s) => s.toUTC().toJSDate());

    const results = await this.reservationRepo
      .createQueryBuilder('r')
      .select('r.slot_start', 'slotStart')
      .addSelect('COUNT(*)', 'count')
      .where('r.service_id = :serviceId', { serviceId })
      .andWhere('r.slot_start IN (:...slotStarts)', { slotStarts: slotStartsUtc })
      .andWhere('r.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .groupBy('r.slot_start')
      .getRawMany();

    const countMap: Record<string, number> = {};
    for (const row of results) {
      // Comparar usando el timestamp UTC
      const slotDt = DateTime.fromJSDate(new Date(row.slotStart), { zone: 'UTC' });
      // Buscar el slotStart original para usar su ISO como clave
      const matchingInput = slotStarts.find(
        (s) => Math.abs(s.toMillis() - slotDt.toMillis()) < 1000,
      );
      if (matchingInput) {
        countMap[matchingInput.toISO()!] = parseInt(row.count, 10);
      }
    }

    return countMap;
  }

  /**
   * Valida y retorna la información de un slot para usarla en la creación de una reserva.
   * Retorna null si el slot no existe o no tiene cupos disponibles.
   */
  async validateSlotForReservation(
    serviceId: string,
    slotStartUtc: Date,
  ): Promise<{ slotEnd: Date; capacity: number } | null> {
    const service = await this.servicesService.findOne(serviceId);

    const slotStartDt = DateTime.fromJSDate(slotStartUtc, { zone: 'UTC' }).setZone(service.timezone);
    const date = slotStartDt.toISODate()!;

    const slots = await this.generateSlots(
      serviceId,
      date,
      service.timezone,
      service.slotDurationMinutes,
    );

    const matchingSlot = slots.find(
      (s) => Math.abs(s.slotStart.toMillis() - slotStartDt.toMillis()) < 1000,
    );

    if (!matchingSlot) return null;

    return {
      slotEnd: matchingSlot.slotEnd.toUTC().toJSDate(),
      capacity: matchingSlot.capacity,
    };
  }
}

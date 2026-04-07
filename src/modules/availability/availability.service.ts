import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Service } from '../services/entities/service.entity';
import { ServicesService } from '../services/services.service';
import { ScheduleRulesService } from '../schedule-rules/schedule-rules.service';
import { ExceptionsService } from '../exceptions/exceptions.service';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationStatus } from '../reservations/entities/reservation.entity';
import { SlotAvailabilityDto, SlotDetailDto } from './dto/availability.dto';
import { ScheduleRule } from '../schedule-rules/entities/schedule-rule.entity';
import { ServiceException } from '../exceptions/entities/service-exception.entity';
import { SessionSpotOverridesService } from '../session-spot-overrides/session-spot-overrides.service';

interface RawSlot {
  slotStart: DateTime;
  slotEnd: DateTime;
  capacity: number;
}

/** Normaliza tiempos de la BD (que vienen como 'HH:MM:SS') a 'HH:MM' */
function normalizeTime(t: string | null): string | null {
  if (!t) return null;
  return t.substring(0, 5);
}

const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.PENDING,
];

/**
 * Devuelve true si la ventana de reserva ya está abierta para este slot.
 *
 * ── day_before ──
 *   La reserva se abre N días antes del evento a las 00:01 (hora local).
 *   Ejemplo: clase lunes, cutoffDays=1 → se puede reservar desde el domingo 00:01.
 *
 * ── hours ──
 *   La reserva se abre N horas antes del inicio del slot.
 *   Ejemplo: clase lunes 19:00, cutoffHours=24 → se puede reservar desde domingo 19:00.
 */
function isWithinBookingWindow(service: Service, slotStart: DateTime, now: DateTime): boolean {
  if (!service.bookingCutoffEnabled) return true; // sin restricción
  let opensDt: DateTime;
  if (service.bookingCutoffMode === 'day_before') {
    opensDt = slotStart
      .setZone(service.timezone)
      .startOf('day')
      .minus({ days: service.bookingCutoffDays ?? 1 })
      .plus({ minutes: 1 });
  } else {
    opensDt = slotStart.minus({ hours: service.bookingCutoffHours });
  }
  return now.toUTC() >= opensDt.toUTC();
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly servicesService: ServicesService,
    private readonly rulesService: ScheduleRulesService,
    private readonly exceptionsService: ExceptionsService,
    private readonly sessionOverridesService: SessionSpotOverridesService,
  ) {}

  async getAvailabilityByDate(
    serviceId: string,
    date: string,
    includePast = false,
  ): Promise<SlotAvailabilityDto[]> {
    const service = await this.servicesService.findOne(serviceId);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date debe tener formato YYYY-MM-DD');
    }

    const slots = await this.generateSlots(
      serviceId,
      date,
      service.timezone,
      service.slotDurationMinutes,
      service.maxSpots,
    );

    if (slots.length === 0) return [];

    const reservationCounts = await this.getReservationCountsBySlots(
      serviceId,
      slots.map((s) => s.slotStart),
    );

    const now = DateTime.now().toUTC();
    return slots
      .filter((slot) => includePast || slot.slotStart.toUTC() > now)
      .map((slot) => {
        const key = slot.slotStart.toISO()!;
        const reserved = reservationCounts[key] ?? 0;
        const available = Math.max(0, slot.capacity - reserved);
        return {
          slot_start: slot.slotStart.toISO()!,
          slot_end: slot.slotEnd.toISO()!,
          capacity: slot.capacity,
          reserved,
          available,
          bookable: available > 0 && isWithinBookingWindow(service, slot.slotStart, now),
        };
      });
  }

  /**
   * Devuelve disponibilidad para un rango de fechas en una sola llamada.
   * Reduce de 7 requests (uno por día) a 1 por servicio en vista semanal.
   */
  async getAvailabilityByDateRange(
    serviceId: string,
    startDate: string,
    endDate: string,
    includePast = false,
  ): Promise<Record<string, SlotAvailabilityDto[]>> {
    const service = await this.servicesService.findOne(serviceId);

    // Generar lista de fechas
    const dates: string[] = [];
    let cursor = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);
    while (cursor <= end) {
      dates.push(cursor.toISODate()!);
      cursor = cursor.plus({ days: 1 });
    }

    // Generar slots para todas las fechas (secuencial para evitar unbounded parallelism)
    const allSlotsByDate: Record<string, RawSlot[]> = {};
    const allSlotStarts: DateTime[] = [];

    for (const d of dates) {
      const slots = await this.generateSlots(
        serviceId, d, service.timezone,
        service.slotDurationMinutes, service.maxSpots,
      );
      allSlotsByDate[d] = slots;
      allSlotStarts.push(...slots.map((s) => s.slotStart));
    }

    // Una sola query de reservas para TODOS los slots del rango
    const reservationCounts = await this.getReservationCountsBySlots(serviceId, allSlotStarts);

    const now = DateTime.now().toUTC();
    const result: Record<string, SlotAvailabilityDto[]> = {};

    for (const d of dates) {
      const slots = allSlotsByDate[d] ?? [];
      result[d] = slots
        .filter((slot) => includePast || slot.slotStart.toUTC() > now)
        .map((slot) => {
          const key = slot.slotStart.toISO()!;
          const reserved = reservationCounts[key] ?? 0;
          const available = Math.max(0, slot.capacity - reserved);
          return {
            slot_start: slot.slotStart.toISO()!,
            slot_end: slot.slotEnd.toISO()!,
            capacity: slot.capacity,
            reserved,
            available,
            bookable: available > 0 && isWithinBookingWindow(service, slot.slotStart, now),
          };
        });
    }

    return result;
  }

  async getAvailabilityBySlot(
    serviceId: string,
    datetimeStr: string,
  ): Promise<SlotDetailDto> {
    const service = await this.servicesService.findOne(serviceId);

    let requestedDt: DateTime;
    try {
      requestedDt = DateTime.fromISO(datetimeStr, { setZone: true });
      if (!requestedDt.isValid) throw new Error('Invalid');
    } catch {
      throw new BadRequestException(`datetime inválido: ${datetimeStr}`);
    }

    const localDt = requestedDt.setZone(service.timezone);
    const date = localDt.toISODate()!;

    const slots = await this.generateSlots(
      serviceId,
      date,
      service.timezone,
      service.slotDurationMinutes,
      service.maxSpots,
    );

    const matchingSlot = slots.find(
      (s) =>
        s.slotStart.toMillis() === requestedDt.toMillis() ||
        s.slotStart.setZone(requestedDt.zoneName!).toISO() === requestedDt.toISO(),
    );

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
    const now = DateTime.now().toUTC();

    return {
      slot_start: matchingSlot.slotStart.toISO()!,
      slot_end: matchingSlot.slotEnd.toISO()!,
      capacity: matchingSlot.capacity,
      reserved,
      available,
      bookable: available > 0 && isWithinBookingWindow(service, matchingSlot.slotStart, now),
      exists: true,
    };
  }

  /**
   * Devuelve los cupos numerados de una sesión específica.
   * Cada cupo tiene número (1..max_spots) y si está disponible o tomado.
   */
  async getSpotsForSlot(
    serviceId: string,
    slotStartIso: string,
  ): Promise<{
    service_id: string;
    slot_start: string;
    slot_end: string;
    max_spots: number;
    spot_label: string | null;
    spots: Array<{ number: number; available: boolean }>;
  }> {
    const service = await this.servicesService.findOne(serviceId);

    let requestedDt: DateTime;
    try {
      requestedDt = DateTime.fromISO(slotStartIso, { setZone: true });
      if (!requestedDt.isValid) throw new Error('Invalid');
    } catch {
      throw new BadRequestException(`slot_start inválido: ${slotStartIso}`);
    }

    const slotDetail = await this.getAvailabilityBySlot(serviceId, slotStartIso);
    if (!slotDetail.exists) {
      throw new NotFoundException(
        `El slot ${slotStartIso} no existe o no está habilitado para el servicio ${serviceId}`,
      );
    }

    // Determinar maxSpots efectivo (override de sesión o default del servicio)
    const slotStartUtc = requestedDt.toUTC().toJSDate();
    const override = await this.sessionOverridesService.findByServiceAndSlot(
      serviceId,
      slotStartUtc,
    );
    const maxSpots = override?.maxSpots ?? service.maxSpots;

    // Cupos tomados (confirmed o pending)
    const takenReservations = await this.reservationRepo.find({
      where: {
        serviceId,
        slotStart: slotStartUtc,
        status: In(ACTIVE_STATUSES),
      },
      select: ['spotNumber'],
    });

    const takenSet = new Set(
      takenReservations
        .map((r) => r.spotNumber)
        .filter((n): n is number => n !== null),
    );

    const spots = Array.from({ length: maxSpots }, (_, i) => ({
      number: i + 1,
      available: !takenSet.has(i + 1),
    }));

    return {
      service_id: serviceId,
      slot_start: slotDetail.slot_start,
      slot_end: slotDetail.slot_end,
      max_spots: maxSpots,
      spot_label: service.spotLabel,
      spots,
    };
  }

  /**
   * Genera los slots válidos para una fecha usando max_spots como capacidad.
   * Los bloques de horario ya no determinan la capacidad; cualquier slot
   * dentro del rango de una regla es reservable con max_spots cupos.
   */
  async generateSlots(
    serviceId: string,
    date: string,
    timezone: string,
    slotDurationMinutes: number,
    maxSpots: number,
  ): Promise<RawSlot[]> {
    const localDate = DateTime.fromISO(date, { zone: timezone });
    if (!localDate.isValid) {
      throw new BadRequestException(`Fecha inválida: ${date}`);
    }
    const dayOfWeek = localDate.weekday;

    const allRules = await this.rulesService.findActiveByServiceAndDay(serviceId, dayOfWeek);
    const rules = allRules.filter((r) => {
      if (r.validFrom && date < r.validFrom) return false;
      if (r.validUntil && date > r.validUntil) return false;
      return true;
    });

    const exceptions = await this.exceptionsService.findByServiceAndDate(serviceId, date);

    const dayClosedException = exceptions.find((e) => e.isClosed && !e.startTime && !e.endTime);
    if (dayClosedException) return [];

    if (rules.length === 0) return [];

    // Cargar overrides de sesión para este día (ventana UTC generosa)
    const startUtc = localDate.toUTC().minus({ hours: 12 }).toJSDate();
    const endUtc = localDate.toUTC().plus({ hours: 36 }).toJSDate();
    const sessionOverrides = await this.sessionOverridesService.findByServiceAndDateRange(
      serviceId,
      startUtc,
      endUtc,
    );
    const overrideMap: Record<string, number> = {};
    for (const o of sessionOverrides) {
      overrideMap[DateTime.fromJSDate(o.slotStart, { zone: 'UTC' }).toISO()!] = o.maxSpots;
    }

    const allSlots: RawSlot[] = [];
    for (const rule of rules) {
      const ruleSlots = this.generateSlotsForRule(
        rule,
        exceptions,
        localDate,
        slotDurationMinutes,
        maxSpots,
        overrideMap,
      );
      allSlots.push(...ruleSlots);
    }

    allSlots.sort((a, b) => a.slotStart.toMillis() - b.slotStart.toMillis());
    return allSlots;
  }

  private generateSlotsForRule(
    rule: ScheduleRule,
    exceptions: ServiceException[],
    localDate: DateTime,
    slotDurationMinutes: number,
    defaultMaxSpots: number,
    overrideMap: Record<string, number>,
  ): RawSlot[] {
    const slots: RawSlot[] = [];

    let dayStartTime = normalizeTime(rule.startTime)!;
    let dayEndTime = normalizeTime(rule.endTime)!;

    const dayOverrideException = exceptions.find(
      (e) => !e.isClosed && e.startTime && e.endTime && !this.isSlotException(e),
    );
    if (dayOverrideException) {
      dayStartTime = normalizeTime(dayOverrideException.startTime)!;
      dayEndTime = normalizeTime(dayOverrideException.endTime)!;
    }

    const [startH, startM] = dayStartTime.split(':').map(Number);
    const [endH, endM] = dayEndTime.split(':').map(Number);

    // Usar fromObject con zona explícita evita ambigüedades en cambios de horario (DST)
    const zone = localDate.zoneName!;
    const { year, month, day } = localDate;
    let current = DateTime.fromObject(
      { year, month, day, hour: startH, minute: startM, second: 0, millisecond: 0 },
      { zone },
    );
    const dayEnd = DateTime.fromObject(
      { year, month, day, hour: endH, minute: endM, second: 0, millisecond: 0 },
      { zone },
    );

    while (current < dayEnd) {
      const slotEnd = current.plus({ minutes: slotDurationMinutes });
      if (slotEnd > dayEnd) break;

      const slotStartTime = current.toFormat('HH:mm');
      const slotEndTime = slotEnd.toFormat('HH:mm');

      // Verificar si el slot está cerrado por excepción
      const closedException = this.findClosingException(exceptions, slotStartTime, slotEndTime);
      if (closedException) {
        current = slotEnd;
        continue;
      }

      // Capacidad: excepción override → sesión override → default maxSpots
      const capacityFromException = this.findCapacityOverride(exceptions, slotStartTime, slotEndTime);
      const slotStartUtcIso = current.toUTC().toISO()!;
      const sessionOverrideCapacity = overrideMap[slotStartUtcIso] ?? null;
      const capacity = capacityFromException ?? sessionOverrideCapacity ?? defaultMaxSpots;

      slots.push({ slotStart: current, slotEnd, capacity });
      current = slotEnd;
    }

    return slots;
  }

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

  private isSlotException(exception: ServiceException): boolean {
    return !!(exception.startTime && exception.endTime);
  }

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
      const slotDt = DateTime.fromJSDate(new Date(row.slotStart), { zone: 'UTC' });
      const matchingInput = slotStarts.find(
        (s) => s.toMillis() === slotDt.toMillis(),
      );
      if (matchingInput) {
        countMap[matchingInput.toISO()!] = parseInt(row.count, 10);
      }
    }

    return countMap;
  }

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
      service.maxSpots,
    );

    const matchingSlot = slots.find(
      (s) => s.slotStart.toMillis() === slotStartDt.toMillis(),
    );

    if (!matchingSlot) return null;

    return {
      slotEnd: matchingSlot.slotEnd.toUTC().toJSDate(),
      capacity: matchingSlot.capacity,
    };
  }
}

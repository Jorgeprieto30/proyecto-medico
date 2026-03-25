// ─── Servicios ───────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  slotDurationMinutes: number;
  maxSpots: number;
  spotLabel: string | null;
  isActive: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDto {
  name: string;
  description?: string;
  timezone: string;
  slotDurationMinutes: number;
  maxSpots: number;
  spotLabel?: string;
  isActive?: boolean;
}

export type UpdateServiceDto = Partial<CreateServiceDto>;

// ─── Reglas semanales ────────────────────────────────────────────────────────
export interface ScheduleRule {
  id: number;
  serviceId: string;
  dayOfWeek: number; // 1=Lunes … 7=Domingo
  startTime: string; // HH:MM
  endTime: string;
  isActive: boolean;
  validFrom: string | null;  // YYYY-MM-DD
  validUntil: string | null; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRuleDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export type UpdateScheduleRuleDto = Partial<CreateScheduleRuleDto>;

// ─── Bloques con capacidad ───────────────────────────────────────────────────
export interface ScheduleBlock {
  id: number;
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleBlockDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive?: boolean;
}

export type UpdateScheduleBlockDto = Partial<CreateScheduleBlockDto>;

// ─── Excepciones ─────────────────────────────────────────────────────────────
export interface ServiceException {
  id: number;
  serviceId: string;
  exceptionDate: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
  capacityOverride: number | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExceptionDto {
  exceptionDate: string;
  startTime?: string;
  endTime?: string;
  isClosed: boolean;
  capacityOverride?: number;
  reason?: string;
}

export type UpdateExceptionDto = Partial<CreateExceptionDto>;

// ─── Session overrides ────────────────────────────────────────────────────────
export interface SessionSpotOverride {
  id: string;
  serviceId: string;
  slotStart: string;
  maxSpots: number;
  createdAt: string;
}

// ─── Disponibilidad ──────────────────────────────────────────────────────────
export interface SlotAvailability {
  slot_start: string;
  slot_end: string;
  capacity: number;
  reserved: number;
  available: number;
  bookable: boolean;
}

export interface SlotDetail extends SlotAvailability {
  exists: boolean;
}

export interface SpotInfo {
  number: number;
  available: boolean;
}

export interface SlotSpots {
  service_id: string;
  slot_start: string;
  slot_end: string;
  max_spots: number;
  spot_label: string | null;
  spots: SpotInfo[];
}

// ─── Reservas ────────────────────────────────────────────────────────────────
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled';

export interface Reservation {
  id: number;
  serviceId: string;
  slotStart: string;
  slotEnd: string;
  status: ReservationStatus;
  customerName: string | null;
  customerExternalId: string | null;
  spotNumber: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDto {
  service_id: string;
  slot_start: string;
  spot_number: number;
  customer_name?: string;
  customer_external_id?: string;
  metadata?: Record<string, unknown>;
}

// ─── API wrapper ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

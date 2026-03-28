import { getSession, signOut } from 'next-auth/react';
import type {
  ApiResponse,
  Service, CreateServiceDto, UpdateServiceDto,
  ScheduleRule, CreateScheduleRuleDto, UpdateScheduleRuleDto,
  ScheduleBlock, CreateScheduleBlockDto, UpdateScheduleBlockDto,
  ServiceException, CreateExceptionDto, UpdateExceptionDto,
  SlotAvailability, SlotDetail, SlotSpots,
  Reservation, CreateReservationDto,
  SessionSpotOverride,
  MemberSummary,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = await getSession();
  const token = (session as any)?.accessToken;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      signOut({ callbackUrl: '/login' });
    }
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message || `Error ${res.status}`;
    throw new ApiError(res.status, msg, json);
  }

  return (json.data ?? json) as T;
}

// ─── Services ────────────────────────────────────────────────────────────────
export const servicesApi = {
  list: () => request<Service[]>('/services'),
  get: (id: string) => request<Service>(`/services/${id}`),
  create: (dto: CreateServiceDto) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateServiceDto) =>
    request<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  delete: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),
  upsertSessionOverride: (id: string, dto: { slot_start: string; max_spots: number }) =>
    request<SessionSpotOverride>(`/services/${id}/session-overrides`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  deleteSessionOverride: (id: string, slot_start: string) =>
    request<void>(`/services/${id}/session-overrides`, {
      method: 'DELETE',
      body: JSON.stringify({ slot_start }),
    }),
};

// ─── Schedule Rules ───────────────────────────────────────────────────────────
export const rulesApi = {
  list: (serviceId: string) =>
    request<ScheduleRule[]>(`/services/${serviceId}/schedule-rules`),
  create: (serviceId: string, dto: CreateScheduleRuleDto) =>
    request<ScheduleRule>(`/services/${serviceId}/schedule-rules`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  update: (ruleId: number, dto: UpdateScheduleRuleDto) =>
    request<ScheduleRule>(`/schedule-rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  delete: (ruleId: number) =>
    request<void>(`/schedule-rules/${ruleId}`, { method: 'DELETE' }),
};

// ─── Schedule Blocks ──────────────────────────────────────────────────────────
export const blocksApi = {
  list: (serviceId: string) =>
    request<ScheduleBlock[]>(`/services/${serviceId}/schedule-blocks`),
  create: (serviceId: string, dto: CreateScheduleBlockDto) =>
    request<ScheduleBlock>(`/services/${serviceId}/schedule-blocks`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  update: (blockId: number, dto: UpdateScheduleBlockDto) =>
    request<ScheduleBlock>(`/schedule-blocks/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  delete: (blockId: number) =>
    request<void>(`/schedule-blocks/${blockId}`, { method: 'DELETE' }),
};

// ─── Exceptions ───────────────────────────────────────────────────────────────
export const exceptionsApi = {
  list: (serviceId: string) =>
    request<ServiceException[]>(`/services/${serviceId}/exceptions`),
  create: (serviceId: string, dto: CreateExceptionDto) =>
    request<ServiceException>(`/services/${serviceId}/exceptions`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  update: (exceptionId: number, dto: UpdateExceptionDto) =>
    request<ServiceException>(`/exceptions/${exceptionId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  delete: (exceptionId: number) =>
    request<void>(`/exceptions/${exceptionId}`, { method: 'DELETE' }),
};

// ─── Availability ─────────────────────────────────────────────────────────────
export const availabilityApi = {
  byDate: (serviceId: string, date: string, includePast = false) =>
    request<SlotAvailability[]>(
      `/availability?service_id=${serviceId}&date=${date}${includePast ? '&include_past=true' : ''}`,
    ),
  bySlot: (serviceId: string, datetime: string) =>
    request<SlotDetail>(
      `/availability/slot?service_id=${serviceId}&datetime=${encodeURIComponent(datetime)}`,
    ),
  spots: (serviceId: string, slotStart: string) =>
    request<SlotSpots>(
      `/availability/spots?service_id=${serviceId}&slot_start=${encodeURIComponent(slotStart)}`,
    ),
};

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (opts: { service_id?: string; date?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.service_id) params.set('service_id', opts.service_id);
    if (opts.date) params.set('date', opts.date);
    if (opts.status) params.set('status', opts.status);
    return request<Reservation[]>(`/reservations?${params}`);
  },
  get: (id: number) => request<Reservation>(`/reservations/${id}`),
  create: (dto: CreateReservationDto) =>
    request<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(dto) }),
  cancel: (id: number) =>
    request<Reservation>(`/reservations/${id}/cancel`, { method: 'PATCH' }),
};

// ─── Members (admin) ─────────────────────────────────────────────────────────
export const membersAdminApi = {
  search: (q: string) =>
    request<MemberSummary[]>(`/members/search?q=${encodeURIComponent(q)}`),
  create: (dto: {
    first_name: string;
    last_name: string;
    email: string;
    rut?: string;
    birth_date?: string;
  }) =>
    request<MemberSummary>('/members/admin-create', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};

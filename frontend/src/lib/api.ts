import { getSession } from 'next-auth/react';
import type {
  ApiResponse,
  Service, CreateServiceDto, UpdateServiceDto,
  ScheduleRule, CreateScheduleRuleDto, UpdateScheduleRuleDto,
  ScheduleBlock, CreateScheduleBlockDto, UpdateScheduleBlockDto,
  ServiceException, CreateExceptionDto, UpdateExceptionDto,
  SlotAvailability, SlotDetail,
  Reservation, CreateReservationDto,
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
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message || `Error ${res.status}`;
    throw new ApiError(res.status, msg, json);
  }

  // Backend wraps responses in { data, timestamp }
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
  byDate: (serviceId: string, date: string) =>
    request<SlotAvailability[]>(
      `/availability?service_id=${serviceId}&date=${date}`,
    ),
  bySlot: (serviceId: string, datetime: string) =>
    request<SlotDetail>(
      `/availability/slot?service_id=${serviceId}&datetime=${encodeURIComponent(datetime)}`,
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

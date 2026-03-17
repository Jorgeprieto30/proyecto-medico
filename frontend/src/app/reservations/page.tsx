'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';

import { servicesApi, reservationsApi, availabilityApi } from '@/lib/api';
import type { Reservation, SlotAvailability } from '@/types';
import { formatDateTime, getStatusLabel, todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

// ─── RUT helpers ──────────────────────────────────────────────────────────────

function normalizeRut(raw: string): string {
  return raw.replace(/\./g, '').trim().toUpperCase();
}

function isValidRut(rut: string): boolean {
  const normalized = normalizeRut(rut);
  if (!/^\d{7,8}-[\dK]$/.test(normalized)) return false;
  const [body, dv] = normalized.split('-');
  const digits = body.split('').reverse().map(Number);
  let sum = 0;
  let factor = 2;
  for (const d of digits) {
    sum += d * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  return dv === expected;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  slot_start: z.string().min(1, 'Requerido'),
  customer_name: z.string().optional(),
  customer_rut: z
    .string()
    .min(1, 'El RUT es requerido')
    .transform(normalizeRut)
    .refine(isValidRut, 'RUT inválido'),
});
type CreateForm = z.infer<typeof createSchema>;

// ─── Availability calendar types ──────────────────────────────────────────────

type DayStatus = 'available' | 'low' | 'full' | 'none';

interface DayInfo {
  status: DayStatus;
  totalAvailable: number;
  totalCapacity: number;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDowOfMonth(year: number, month: number) {
  // Returns 0=Mon…6=Sun (ISO week)
  const raw = new Date(year, month, 1).getDay(); // 0=Sun
  return raw === 0 ? 6 : raw - 1;
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

// ─── AvailabilityCalendarPicker ───────────────────────────────────────────────

function AvailabilityCalendarPicker({
  serviceId,
  selectedDate,
  onSelectDate,
}: {
  serviceId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = todayAsString();
  const todayDate = new Date(today + 'T12:00:00');

  // Start the calendar on the month of selectedDate or today
  const initDate = selectedDate || today;
  const [calYear, setCalYear]   = useState(() => new Date(initDate + 'T12:00:00').getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date(initDate + 'T12:00:00').getMonth());
  const [monthData, setMonthData] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading]   = useState(false);

  const fetchMonth = useCallback(async (svcId: string, year: number, month: number) => {
    if (!svcId) return;
    setLoading(true);
    const numDays = daysInMonth(year, month);
    const dates = Array.from({ length: numDays }, (_, i) => toDateStr(year, month, i + 1));

    // Only fetch today and future
    const futureDates = dates.filter((d) => d >= today);
    const results: Record<string, DayInfo> = {};

    // Fetch all days in parallel
    await Promise.all(
      futureDates.map(async (d) => {
        try {
          const slots = await availabilityApi.byDate(svcId, d);
          if (slots.length === 0) {
            results[d] = { status: 'none', totalAvailable: 0, totalCapacity: 0 };
            return;
          }
          const totalAvailable = slots.reduce((s, sl) => s + sl.available, 0);
          const totalCapacity  = slots.reduce((s, sl) => s + sl.capacity,  0);
          let status: DayStatus;
          if (totalAvailable === 0) status = 'full';
          else if (totalAvailable <= 3) status = 'low';
          else status = 'available';
          results[d] = { status, totalAvailable, totalCapacity };
        } catch {
          results[d] = { status: 'none', totalAvailable: 0, totalCapacity: 0 };
        }
      }),
    );
    setMonthData(results);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    if (serviceId) fetchMonth(serviceId, calYear, calMonth);
    else setMonthData({});
  }, [serviceId, calYear, calMonth, fetchMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  const numDays  = daysInMonth(calYear, calMonth);
  const offset   = firstDowOfMonth(calYear, calMonth);

  const statusDot: Record<DayStatus, string> = {
    available: 'bg-green-500',
    low:       'bg-orange-400',
    full:      'bg-red-400',
    none:      '',
  };

  const isDisabled = (dateStr: string) => {
    if (dateStr < today) return true;
    if (!serviceId) return true;
    if (loading) return false; // allow click once loaded
    const info = monthData[dateStr];
    return !info || info.status === 'none' || info.status === 'full';
  };

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {MONTH_NAMES[calMonth]} {calYear}
          {loading && <span className="ml-2 text-xs text-gray-400 font-normal">cargando...</span>}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['L','M','X','J','V','S','D'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: numDays }, (_, i) => {
          const day = i + 1;
          const dateStr  = toDateStr(calYear, calMonth, day);
          const info     = monthData[dateStr];
          const disabled = isDisabled(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday    = dateStr === today;
          const isPast     = dateStr < today;

          return (
            <button
              type="button"
              key={day}
              disabled={disabled || !serviceId}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition-colors
                ${isSelected ? 'bg-blue-600 text-white font-bold' :
                  isPast ? 'text-gray-300 cursor-not-allowed' :
                  disabled ? 'text-gray-300 cursor-not-allowed' :
                  'hover:bg-blue-50 text-gray-700 cursor-pointer'
                }
                ${isToday && !isSelected ? 'ring-2 ring-blue-400 ring-inset' : ''}
              `}
            >
              <span>{day}</span>
              {/* Availability dot */}
              {!isPast && info && info.status !== 'none' && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : statusDot[info.status]}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {serviceId && !loading && (
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Disponible</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />Pocos cupos</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Lleno</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient();

  const [serviceId, setServiceId] = useState<string>('');
  const [date, setDate] = useState(todayAsString());
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);

  // Form state for the selected date inside the modal
  const [formDate, setFormDate] = useState(todayAsString());

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['reservations', serviceId, date, statusFilter],
    queryFn: () =>
      reservationsApi.list({
        service_id: serviceId || undefined,
        date: date || undefined,
        status: (statusFilter as 'confirmed' | 'pending' | 'cancelled') || undefined,
      }),
    enabled: true,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const formServiceId = watch('service_id');

  const loadSlots = async (svcId: string, d: string) => {
    if (!svcId || !d) { setSlots([]); return; }
    try {
      const data = await availabilityApi.byDate(svcId, d);
      setSlots(data.filter((s) => s.bookable));
    } catch {
      setSlots([]);
    }
  };

  // When service or date changes in the form, reload slots
  const handleDateSelect = (d: string) => {
    setFormDate(d);
    setValue('slot_start', ''); // reset slot selection
    loadSlots(formServiceId, d);
  };

  const handleServiceChange = (svcId: string) => {
    setValue('service_id', svcId);
    setValue('slot_start', '');
    setSlots([]);
    if (svcId && formDate) loadSlots(svcId, formDate);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      reservationsApi.create({
        service_id: data.service_id,
        slot_start: data.slot_start,
        customer_name: data.customer_name,
        customer_external_id: data.customer_rut,
      }),
    onSuccess: () => {
      toast.success('Reserva creada exitosamente');
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reservationsApi.cancel(id),
    onSuccess: () => {
      toast.success('Reserva cancelada');
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      setCancelling(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    const today = todayAsString();
    reset({ service_id: '', slot_start: '', customer_name: '', customer_rut: '' });
    setFormDate(today);
    setSlots([]);
    setCreateOpen(true);
  };

  const canCancel = (r: Reservation) => r.status === 'confirmed' || r.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-500 text-sm mt-1">Consulta, crea y cancela reservas de cupos.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva reserva
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-56">
          <Label>Servicio</Label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">Todos los servicios</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Fecha</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>

        <div className="w-44">
          <Label>Estado</Label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="confirmed">Confirmado</option>
            <option value="pending">Pendiente</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <PageSpinner />
      ) : !reservations?.length ? (
        <EmptyState
          title="Sin reservas"
          description="No hay reservas con los filtros actuales."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva reserva
            </Button>
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['ID', 'Servicio', 'Cliente', 'RUT', 'Inicio', 'Fin', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">#{r.id}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {services?.find((s) => s.id === r.serviceId)?.name ?? `Servicio #${r.serviceId}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.customerName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.customerExternalId ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(r.slotStart)}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(r.slotEnd)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        r.status === 'confirmed' ? 'success' :
                        r.status === 'pending' ? 'warning' : 'muted'
                      }
                    >
                      {getStatusLabel(r.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canCancel(r) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCancelling(r)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                        Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva reserva"
        description="Crea una reserva manualmente para un cupo disponible."
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
          {/* 1. Service */}
          <div>
            <Label>Servicio *</Label>
            <select
              {...register('service_id')}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="" disabled>Seleccionar servicio...</option>
              {services?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.service_id && (
              <p className="text-xs text-red-500 mt-1">{errors.service_id.message}</p>
            )}
          </div>

          {/* 2. Calendar date picker */}
          <div>
            <Label>Fecha *</Label>
            {!formServiceId ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
                Selecciona un servicio para ver los días disponibles
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                <AvailabilityCalendarPicker
                  serviceId={formServiceId}
                  selectedDate={formDate}
                  onSelectDate={handleDateSelect}
                />
              </div>
            )}
          </div>

          {/* 3. Slot selector */}
          {formServiceId && formDate && (
            <div>
              <Label>Horario *</Label>
              {slots.length === 0 ? (
                <p className="text-xs text-gray-400 mt-1">
                  {formDate
                    ? 'No hay cupos disponibles para esta fecha.'
                    : 'Selecciona una fecha con disponibilidad.'}
                </p>
              ) : (
                <select
                  {...register('slot_start')}
                  className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">Seleccionar horario...</option>
                  {slots.map((sl) => {
                    const svc = services?.find((s) => s.id === formServiceId);
                    const start = new Date(sl.slot_start).toLocaleTimeString('es-CL', {
                      hour: '2-digit', minute: '2-digit', timeZone: svc?.timezone,
                    });
                    const end = new Date(sl.slot_end).toLocaleTimeString('es-CL', {
                      hour: '2-digit', minute: '2-digit', timeZone: svc?.timezone,
                    });
                    return (
                      <option key={sl.slot_start} value={sl.slot_start}>
                        {start}–{end} · {sl.available} cupo{sl.available !== 1 ? 's' : ''} disponible{sl.available !== 1 ? 's' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
              {errors.slot_start && (
                <p className="text-xs text-red-500 mt-1">{errors.slot_start.message}</p>
              )}
            </div>
          )}

          {/* 4. Customer fields */}
          <div>
            <Label>Nombre del cliente (opcional)</Label>
            <Input {...register('customer_name')} className="mt-1" placeholder="Nombre completo" />
          </div>

          <div>
            <Label>RUT del cliente *</Label>
            <Input
              {...register('customer_rut')}
              className="mt-1"
              placeholder="12345678-9"
            />
            {errors.customer_rut && (
              <p className="text-xs text-red-500 mt-1">{errors.customer_rut.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear reserva'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
        loading={cancelMutation.isPending}
        title="Cancelar reserva"
        description={`¿Cancelar la reserva #${cancelling?.id}? El cupo quedará libre nuevamente.`}
        confirmLabel="Sí, cancelar"
      />
    </div>
  );
}

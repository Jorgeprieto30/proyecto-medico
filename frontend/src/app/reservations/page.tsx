'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient();

  const [serviceId, setServiceId] = useState<string>('');
  const [date, setDate] = useState(todayAsString());
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);

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
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const formServiceId = watch('service_id');

  const loadSlots = async (svcId: string, d: string) => {
    if (!svcId || !d) return;
    try {
      const data = await availabilityApi.byDate(svcId, d);
      setSlots(data.filter((s) => s.bookable));
    } catch {
      setSlots([]);
    }
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
    reset({ service_id: '', slot_start: '', customer_name: '', customer_rut: '' });
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
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Servicio *</Label>
            <select
              {...register('service_id')}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onChange={(e) => loadSlots(e.target.value, todayAsString())}
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

          <div>
            <Label>Fecha del slot</Label>
            <Input
              type="date"
              className="mt-1"
              defaultValue={todayAsString()}
              onChange={(e) => loadSlots(formServiceId, e.target.value)}
            />
          </div>

          <div>
            <Label>Slot horario *</Label>
            <select
              {...register('slot_start')}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Seleccionar slot...</option>
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
                    {start}–{end} ({sl.available} cupos)
                  </option>
                );
              })}
            </select>
            {slots.length === 0 && !!formServiceId && (
              <p className="text-xs text-gray-400 mt-1">
                Selecciona un servicio y fecha para ver los slots disponibles.
              </p>
            )}
            {errors.slot_start && (
              <p className="text-xs text-red-500 mt-1">{errors.slot_start.message}</p>
            )}
          </div>

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

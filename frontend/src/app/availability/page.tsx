'use client';

import { useState, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { servicesApi, availabilityApi, reservationsApi } from '@/lib/api';
import type { SlotAvailability } from '@/types';
import {
  formatTime,
  getAvailabilityColor,
  todayAsString,
} from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const reserveSchema = z.object({
  customer_name: z.string().optional(),
  customer_external_id: z.string().optional(),
});
type ReserveForm = z.infer<typeof reserveSchema>;

function AvailabilityContent() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [serviceId, setServiceId] = useState<number>(
    Number(searchParams.get('service_id')) || 0,
  );
  const [date, setDate] = useState(searchParams.get('date') || todayAsString());
  const [bookingSlot, setBookingSlot] = useState<SlotAvailability | null>(null);

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const service = services?.find((s) => s.id === serviceId);

  const {
    data: slots,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['availability', serviceId, date],
    queryFn: () => availabilityApi.byDate(serviceId, date),
    enabled: !!serviceId && !!date,
  });

  const { register, handleSubmit, reset } = useForm<ReserveForm>({
    resolver: zodResolver(reserveSchema),
  });

  const reserveMutation = useMutation({
    mutationFn: (data: ReserveForm) =>
      reservationsApi.create({
        service_id: serviceId,
        slot_start: bookingSlot!.slot_start,
        ...data,
      }),
    onSuccess: () => {
      toast.success('¡Cupo reservado exitosamente!');
      qc.invalidateQueries({ queryKey: ['availability', serviceId, date] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setBookingSlot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const totalAvailable = slots?.reduce((sum, s) => sum + s.available, 0) ?? 0;
  const totalCapacity = slots?.reduce((sum, s) => sum + s.capacity, 0) ?? 0;
  const totalReserved = slots?.reduce((sum, s) => sum + s.reserved, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disponibilidad</h1>
        <p className="text-gray-500 text-sm mt-1">
          Consulta los cupos disponibles por fecha y reserva directamente.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-60">
          <Label>Servicio</Label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(Number(e.target.value))}
            className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value={0} disabled>Seleccionar servicio...</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Fecha</Label>
          <div className="flex items-center gap-2 mt-1">
            <Button size="icon" variant="outline" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
            <Button size="icon" variant="outline" onClick={() => changeDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDate(todayAsString())}>
              Hoy
            </Button>
          </div>
        </div>

        {serviceId > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        )}
      </div>

      {/* Resumen del día */}
      {slots && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">Capacidad total</p>
              <p className="text-2xl font-bold text-gray-900">{totalCapacity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">Reservados</p>
              <p className="text-2xl font-bold text-blue-600">{totalReserved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">Disponibles</p>
              <p className={`text-2xl font-bold ${totalAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalAvailable}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Slots */}
      {!serviceId ? (
        <EmptyState title="Selecciona un servicio" description="Elige un servicio y una fecha para ver la disponibilidad." />
      ) : isLoading ? (
        <PageSpinner />
      ) : !slots?.length ? (
        <EmptyState
          title="Sin slots disponibles"
          description="No hay bloques configurados para esta fecha. Verifica las reglas semanales y los bloques de capacidad del servicio."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {slots.map((slot) => {
            const startTime = new Date(slot.slot_start).toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: service?.timezone,
            });
            const endTime = new Date(slot.slot_end).toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: service?.timezone,
            });
            const pct = slot.capacity > 0 ? (slot.available / slot.capacity) * 100 : 0;
            const colorClass = getAvailabilityColor(slot.available, slot.capacity);

            return (
              <div
                key={slot.slot_start}
                className={`border rounded-lg p-4 transition-all ${
                  slot.bookable
                    ? 'cursor-pointer hover:border-blue-400 hover:shadow-md'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (slot.bookable) {
                    setBookingSlot(slot);
                    reset();
                  }
                }}
              >
                <div className="font-semibold text-gray-900">
                  {startTime} – {endTime}
                </div>

                {/* Barra de capacidad */}
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      slot.available === 0 ? 'bg-red-500' :
                      pct <= 25 ? 'bg-orange-500' :
                      pct <= 50 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                  {slot.available === 0 ? '🔴 Sin cupos' : `🟢 ${slot.available} de ${slot.capacity} disponibles`}
                </div>

                {slot.bookable && (
                  <p className="mt-2 text-xs text-blue-600 font-medium">Clic para reservar →</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de reserva */}
      <Modal
        open={!!bookingSlot}
        onClose={() => setBookingSlot(null)}
        title="Reservar cupo"
        description={bookingSlot ? (() => {
          const start = new Date(bookingSlot.slot_start).toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit', timeZone: service?.timezone,
          });
          const end = new Date(bookingSlot.slot_end).toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit', timeZone: service?.timezone,
          });
          return `${service?.name} · ${date} · ${start}–${end} · ${bookingSlot.available} cupos disponibles`;
        })() : ''}
      >
        <form onSubmit={handleSubmit((d) => reserveMutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Nombre del cliente (opcional)</Label>
            <Input {...register('customer_name')} className="mt-1" placeholder="Nombre completo" />
          </div>
          <div>
            <Label>ID externo del cliente (opcional)</Label>
            <Input {...register('customer_external_id')} className="mt-1" placeholder="ej: RUT, ID sistema" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setBookingSlot(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={reserveMutation.isPending}>
              {reserveMutation.isPending ? 'Reservando...' : 'Confirmar reserva'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <Suspense>
      <AvailabilityContent />
    </Suspense>
  );
}

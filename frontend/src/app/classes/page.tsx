'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, Users, CalendarDays } from 'lucide-react';

import { servicesApi, rulesApi, blocksApi } from '@/lib/api';
import type { Service } from '@/types';
import { DAY_NAMES, todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

const TIMEZONES = [
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'UTC',
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  capacity:  z.coerce.number().min(1, 'Mínimo 1'),
});

const eventSchema = z.object({
  name:                z.string().min(1, 'Nombre requerido'),
  description:         z.string().optional(),
  timezone:            z.string().min(1, 'Timezone requerido'),
  slotDurationMinutes: z.coerce.number().min(5).max(480),
  days:                z.array(z.number()).min(1, 'Selecciona al menos un día'),
  timeSlots:           z.array(timeSlotSchema).min(1, 'Agrega al menos un horario'),
  validFrom:           z.string().optional(),
  validUntil:          z.string().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

const DEFAULT_VALUES: EventForm = {
  name:                '',
  description:         '',
  timezone:            'America/Santiago',
  slotDurationMinutes: 60,
  days:                [],
  timeSlots:           [{ startTime: '08:00', endTime: '09:00', capacity: 5 }],
  validFrom:           todayAsString(),
  validUntil:          '',
};

export default function EventosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Service | null>(null);
  const [deleting, setDeleting]   = useState<Service | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn:  servicesApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<EventForm>({
    resolver:      zodResolver(eventSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: slotFields, append: appendSlot, remove: removeSlot } = useFieldArray({
    control,
    name: 'timeSlots',
  });

  const selectedDays = watch('days');

  const openCreate = () => {
    reset(DEFAULT_VALUES);
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (svc: Service) => {
    reset({
      name:                svc.name,
      description:         svc.description ?? '',
      timezone:            svc.timezone,
      slotDurationMinutes: svc.slotDurationMinutes,
      days:                [],
      timeSlots:           [{ startTime: '08:00', endTime: '09:00', capacity: 5 }],
      validFrom:           todayAsString(),
      validUntil:          '',
    });
    setEditing(svc);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      let serviceId: string;

      if (editing) {
        await servicesApi.update(editing.id, {
          name:                data.name,
          description:         data.description,
          timezone:            data.timezone,
          slotDurationMinutes: data.slotDurationMinutes,
        });
        serviceId = editing.id;
      } else {
        const svc = await servicesApi.create({
          name:                data.name,
          description:         data.description,
          timezone:            data.timezone,
          slotDurationMinutes: data.slotDurationMinutes,
        });
        serviceId = svc.id;

        // For each day × each time slot → create rule + block
        for (const day of data.days) {
          for (const slot of data.timeSlots) {
            await rulesApi.create(serviceId, {
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime:   slot.endTime,
              validFrom:  data.validFrom || undefined,
              validUntil: data.validUntil || undefined,
            });
            await blocksApi.create(serviceId, {
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime:   slot.endTime,
              capacity:  slot.capacity,
            });
          }
        }
      }

      return serviceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(editing ? 'Evento actualizado' : 'Evento creado exitosamente');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => servicesApi.update(id, { isActive: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Evento desactivado');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (svc: Service) => servicesApi.update(svc.id, { isActive: !svc.isActive }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(updated.isActive ? 'Evento activado' : 'Evento desactivado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Evento eliminado');
      setDeleteId(null);
    },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Crea y administra los tipos de evento con sus horarios y capacidades.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo evento
        </Button>
      </div>

      {!services?.length ? (
        <EmptyState
          title="Sin eventos"
          description="Crea tu primer evento configurando su horario, días y capacidad."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo evento
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <EventCard
              key={svc.id}
              service={svc}
              onEdit={() => openEdit(svc)}
              onDeactivate={() => setDeleting(svc)}
              onDelete={() => setDeleteId(svc.id)}
              onToggle={() => toggleMutation.mutate(svc)}
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar: ${editing.name}` : 'Nuevo evento'}
        description={
          editing
            ? 'Modifica los datos básicos del evento. Para editar horarios usa la pestaña de Horarios.'
            : 'Configura el nombre, duración, días y horarios del nuevo evento.'
        }
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nombre del evento *</Label>
              <Input {...register('name')} className="mt-1" placeholder="ej: Yoga, Spinning, Pilates" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="col-span-2">
              <Label>Descripción (opcional)</Label>
              <Input {...register('description')} className="mt-1" placeholder="Descripción breve" />
            </div>

            <div>
              <Label>Zona horaria *</Label>
              <select
                {...register('timezone')}
                className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Duración del slot (minutos) *</Label>
              <Input
                type="number" min={5} max={480}
                {...register('slotDurationMinutes')}
                className="mt-1" placeholder="60"
              />
              {errors.slotDurationMinutes && (
                <p className="text-xs text-red-500 mt-1">{errors.slotDurationMinutes.message}</p>
              )}
            </div>
          </div>

          {!editing && (
            <>
              <hr className="border-gray-100" />

              {/* Days */}
              <div>
                <Label>Días de la semana *</Label>
                <Controller
                  name="days"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((day) => {
                        const checked = field.value.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                checked
                                  ? field.value.filter((d) => d !== day)
                                  : [...field.value, day],
                              )
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              checked
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {DAY_NAMES[day]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                {errors.days && (
                  <p className="text-xs text-red-500 mt-1">{errors.days.message as string}</p>
                )}
              </div>

              {/* Time slots */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Horarios *</Label>
                  <button
                    type="button"
                    onClick={() => appendSlot({ startTime: '', endTime: '', capacity: 5 })}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Añadir horario
                  </button>
                </div>

                <div className="space-y-2">
                  {slotFields.map((field, idx) => (
                    <div key={field.id} className="flex items-start gap-2 p-3 border rounded-lg bg-gray-50">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">Inicio</Label>
                          <Input
                            type="time"
                            {...register(`timeSlots.${idx}.startTime`)}
                            className="mt-0.5 h-8 text-sm"
                          />
                          {errors.timeSlots?.[idx]?.startTime && (
                            <p className="text-xs text-red-500">{errors.timeSlots[idx]?.startTime?.message}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Fin</Label>
                          <Input
                            type="time"
                            {...register(`timeSlots.${idx}.endTime`)}
                            className="mt-0.5 h-8 text-sm"
                          />
                          {errors.timeSlots?.[idx]?.endTime && (
                            <p className="text-xs text-red-500">{errors.timeSlots[idx]?.endTime?.message}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Cupos</Label>
                          <Input
                            type="number" min={1}
                            {...register(`timeSlots.${idx}.capacity`)}
                            className="mt-0.5 h-8 text-sm"
                            placeholder="5"
                          />
                          {errors.timeSlots?.[idx]?.capacity && (
                            <p className="text-xs text-red-500">{errors.timeSlots[idx]?.capacity?.message}</p>
                          )}
                        </div>
                      </div>
                      {slotFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(idx)}
                          className="mt-5 p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.timeSlots?.root && (
                  <p className="text-xs text-red-500 mt-1">{errors.timeSlots.root.message}</p>
                )}
                {selectedDays.length > 0 && slotFields.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Se crearán {selectedDays.length * slotFields.length} horario(s): {selectedDays.length} día(s) × {slotFields.length} franja(s)
                  </p>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha de inicio</Label>
                  <Input type="date" {...register('validFrom')} className="mt-1" />
                  <p className="text-xs text-gray-400 mt-0.5">Desde cuándo aplica el horario</p>
                </div>
                <div>
                  <Label>Fecha de fin (opcional)</Label>
                  <Input type="date" {...register('validUntil')} className="mt-1" />
                  <p className="text-xs text-gray-400 mt-0.5">Vacío = sin fecha límite</p>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deactivateMutation.mutate(deleting.id)}
        loading={deactivateMutation.isPending}
        title="Desactivar evento"
        description={`¿Desactivar "${deleting?.name}"? El evento quedará inactivo y no generará disponibilidad.`}
        confirmLabel="Desactivar"
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Eliminar evento"
        description="Esta acción es permanente. Se eliminará el evento y toda su configuración de horarios."
        confirmLabel="Eliminar"
        variant="destructive"
      />
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  service, onEdit, onDeactivate, onDelete, onToggle, toggling,
}: {
  service: Service;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { data: rules } = useQuery({
    queryKey: ['rules', service.id],
    queryFn:  () => rulesApi.list(service.id),
  });

  const activeDays = Array.from(
    new Set(rules?.filter((r) => r.isActive).map((r) => r.dayOfWeek) ?? []),
  ).sort();

  // Group rules by day to show multiple times
  const timesByDay = activeDays.map((day) => ({
    day,
    times: rules?.filter((r) => r.isActive && r.dayOfWeek === day) ?? [],
  }));

  return (
    <div className="border rounded-xl p-5 bg-white hover:shadow-md transition-shadow space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{service.name}</h3>
          {service.description && (
            <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
          )}
        </div>
        <Badge variant={service.isActive ? 'success' : 'muted'}>
          {service.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span>{service.slotDurationMinutes} min · {service.timezone}</span>
        </div>

        {/* Show all time slots grouped by day */}
        {timesByDay.length > 0 && (
          <div className="flex items-start gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {timesByDay.map(({ day, times }) => (
                <div key={day} className="text-xs">
                  <span className="font-medium text-gray-700">{DAY_NAMES[day]}:</span>{' '}
                  {times.map((t, i) => (
                    <span key={t.id}>
                      {t.startTime.substring(0, 5)}–{t.endTime.substring(0, 5)}
                      {i < times.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeDays.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {activeDays.map((d) => (
                <span key={d} className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                  {DAY_NAMES[d]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toggle + actions */}
      <div className="flex items-center justify-between pt-1">
        {/* Active toggle */}
        <button
          role="switch"
          aria-checked={service.isActive}
          onClick={onToggle}
          disabled={toggling}
          title={service.isActive ? 'Desactivar' : 'Activar'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
            service.isActive ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${service.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>

        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
          <Button
            size="sm" variant="ghost"
            onClick={() => window.open(`/services/${service.id}`, '_blank')}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            Horarios →
          </Button>
          {service.isActive ? (
            <Button size="sm" variant="ghost" onClick={onDeactivate} className="text-orange-500 hover:text-orange-700 hover:bg-orange-50">
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

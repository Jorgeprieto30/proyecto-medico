'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, Globe, CalendarPlus, Eye } from 'lucide-react';

import { servicesApi, rulesApi } from '@/lib/api';
import type { Service, ScheduleRule } from '@/types';
import { DAY_NAMES, todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { UnifiedEditModal } from '@/components/services/unified-edit-modal';
import { BookingModal } from '@/components/services/booking-modal';

// ─── Short day labels ──────────────────────────────────────────────────────────

const DAY_SHORT: Record<number, string> = {
  1: 'Lu', 2: 'Ma', 3: 'Mi', 4: 'Ju', 5: 'Vi', 6: 'Sá', 7: 'Do',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'America/Santiago', 'America/Buenos_Aires', 'America/Lima',
  'America/Bogota', 'America/Mexico_City', 'America/New_York', 'UTC',
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
});

const createSchema = z.object({
  name:                z.string().min(1, 'Nombre requerido'),
  description:         z.string().optional(),
  timezone:            z.string().min(1),
  slotDurationMinutes: z.coerce.number().min(5).max(480),
  maxSpots:            z.coerce.number().min(1, 'Mínimo 1').max(500, 'Máximo 500'),
  spotLabel:           z.string().optional(),
  days:                z.array(z.number()).min(1, 'Selecciona al menos un día'),
  timeSlots: z.array(timeSlotSchema).min(1, 'Agrega al menos un horario'),
  validFrom:           z.string().optional(),
  validUntil:          z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const DEFAULT_CREATE: CreateForm = {
  name: '', description: '', timezone: 'America/Santiago',
  slotDurationMinutes: 60, maxSpots: 20, spotLabel: '',
  days: [],
  timeSlots: [{ startTime: '08:00', endTime: '09:00' }],
  validFrom: todayAsString(), validUntil: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventosPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen]       = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [viewServiceId, setViewServiceId] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn:  servicesApi.list,
  });

  const {
    register, handleSubmit, reset, control, watch,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: DEFAULT_CREATE,
  });

  const { fields: slotFields, append: appendSlot, remove: removeSlot } = useFieldArray({
    control, name: 'timeSlots',
  });

  const selectedDays = watch('days');

  const openCreate = () => { reset(DEFAULT_CREATE); setCreateOpen(true); };

  const createMutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      const svc = await servicesApi.create({
        name: data.name,
        description: data.description,
        timezone: data.timezone,
        slotDurationMinutes: data.slotDurationMinutes,
        maxSpots: data.maxSpots,
        spotLabel: data.spotLabel || undefined,
      });
      for (const day of data.days) {
        for (const slot of data.timeSlots) {
          await rulesApi.create(svc.id, {
            dayOfWeek: day, startTime: slot.startTime, endTime: slot.endTime,
            validFrom: data.validFrom || undefined, validUntil: data.validUntil || undefined,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Evento creado');
      setCreateOpen(false);
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
      {/* Header */}
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

      {/* List */}
      {!services?.length ? (
        <EmptyState
          title="Sin eventos"
          description="Crea tu primer evento configurando su horario, días y capacidad."
          action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Nuevo evento</Button>}
        />
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden divide-y">
          {services.map((svc) => (
            <EventRow
              key={svc.id}
              service={svc}
              onView={() => setViewServiceId(svc.id)}
              onEdit={() => setEditServiceId(svc.id)}
              onToggle={() => toggleMutation.mutate(svc)}
              toggling={toggleMutation.isPending}
              onDelete={() => setDeleteId(svc.id)}
              onBook={() => setBookingService(svc)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo evento"
        description="Configura el nombre, duración, días y horarios del nuevo evento."
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit((d) => { if (!createMutation.isPending) createMutation.mutate(d); })} className="space-y-5">
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
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <Label>Duración del slot (min) *</Label>
              <Input type="number" min={5} max={480} {...register('slotDurationMinutes')} className="mt-1" placeholder="60" />
              {errors.slotDurationMinutes && <p className="text-xs text-red-500 mt-1">{errors.slotDurationMinutes.message}</p>}
            </div>
            <div>
              <Label>Cupos máximos por sesión *</Label>
              <Input type="number" min={1} max={500} {...register('maxSpots')} className="mt-1" placeholder="20" />
              <p className="text-xs text-gray-400 mt-0.5">Cantidad total de cupos numerados (ej: 20 bicicletas)</p>
              {errors.maxSpots && <p className="text-xs text-red-500 mt-1">{errors.maxSpots.message}</p>}
            </div>
            <div className="col-span-2">
              <Label>Etiqueta de cupo (opcional)</Label>
              <Input {...register('spotLabel')} className="mt-1" placeholder='ej: "Bici" → muestra "Bici 1", "Bici 2"…' />
              <p className="text-xs text-gray-400 mt-0.5">Si se deja vacío, se muestra solo el número</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Days */}
          <div>
            <Label>Días de la semana *</Label>
            <Controller
              name="days" control={control}
              render={({ field }) => (
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const checked = field.value.includes(day);
                    return (
                      <button
                        key={day} type="button"
                        onClick={() => field.onChange(checked ? field.value.filter((d) => d !== day) : [...field.value, day])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {DAY_NAMES[day]}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.days && <p className="text-xs text-red-500 mt-1">{errors.days.message as string}</p>}
          </div>

          {/* Time slots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Horarios *</Label>
              <button type="button" onClick={() => appendSlot({ startTime: '', endTime: '' })}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Añadir horario
              </button>
            </div>
            <div className="space-y-2">
              {slotFields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-2 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Inicio</Label>
                      <Input type="time" {...register(`timeSlots.${idx}.startTime`)} className="mt-0.5 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Fin</Label>
                      <Input type="time" {...register(`timeSlots.${idx}.endTime`)} className="mt-0.5 h-8 text-sm" />
                    </div>
                  </div>
                  {slotFields.length > 1 && (
                    <button type="button" onClick={() => removeSlot(idx)} className="mt-5 p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear evento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Service detail modal */}
      <ServiceDetailModal
        serviceId={viewServiceId}
        onClose={() => setViewServiceId(null)}
        onEdit={(id) => { setViewServiceId(null); setEditServiceId(id); }}
      />

      {/* Unified edit modal */}
      <UnifiedEditModal
        serviceId={editServiceId}
        onClose={() => setEditServiceId(null)}
      />

      {/* Booking modal */}
      <BookingModal
        service={bookingService}
        onClose={() => setBookingService(null)}
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

// ─── Service Detail Modal ─────────────────────────────────────────────────────

function ServiceDetailModal({
  serviceId,
  onClose,
  onEdit,
}: {
  serviceId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: servicesApi.list });
  const service = services?.find((s) => s.id === serviceId);

  const { data: rules = [] } = useQuery<ScheduleRule[]>({
    queryKey: ['rules', serviceId],
    queryFn: () => rulesApi.list(serviceId!),
    enabled: !!serviceId,
  });

  const allDays = [1, 2, 3, 4, 5, 6, 7];
  const activeDays = Array.from(new Set(rules.filter((r) => r.isActive).map((r) => r.dayOfWeek))).sort();

  return (
    <Modal
      open={!!serviceId}
      onClose={onClose}
      title={service?.name ?? ''}
      description={service?.description ?? undefined}
      className="max-w-lg"
    >
      {service && (
        <div className="space-y-5">
          {/* Info chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${service.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
              {service.isActive ? 'Activo' : 'Inactivo'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              <Clock className="h-3 w-3" />{service.slotDurationMinutes} min por slot
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              {service.maxSpots} {service.spotLabel ? `${service.spotLabel}s` : 'cupos'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <Globe className="h-3 w-3" />{service.timezone}
            </span>
          </div>

          {/* Schedule */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Horario semanal</h3>
            {activeDays.length === 0 ? (
              <p className="text-sm text-gray-400">Sin horarios configurados.</p>
            ) : (
              <div className="space-y-2">
                {activeDays.map((day) => {
                  const dayRules = rules.filter((r) => r.dayOfWeek === day && r.isActive);
                  return (
                    <div key={day} className="flex gap-3 items-start">
                      <span className="shrink-0 w-8 text-xs font-semibold text-gray-500 pt-1">
                        {DAY_NAMES[day].slice(0, 2)}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {dayRules.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800"
                          >
                            {r.startTime}–{r.endTime}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Days pill row */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Días activos</h3>
            <div className="flex gap-1">
              {allDays.map((d) => (
                <span
                  key={d}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                    activeDays.includes(d) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'
                  }`}
                >
                  {DAY_SHORT[d]}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => onEdit(service.id)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar evento
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({
  service, onView, onEdit, onToggle, toggling, onDelete, onBook,
}: {
  service: Service;
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
  onDelete: () => void;
  onBook: () => void;
}) {
  const { data: rules } = useQuery({
    queryKey: ['rules', service.id],
    queryFn:  () => rulesApi.list(service.id),
  });

  const activeDays = Array.from(
    new Set(rules?.filter((r) => r.isActive).map((r) => r.dayOfWeek) ?? []),
  ).sort();

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">

      {/* Status dot */}
      <div className={`shrink-0 w-2.5 h-2.5 rounded-full ${service.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <button onClick={onView} className="font-semibold text-gray-900 truncate hover:text-blue-600 text-left block w-full">
          {service.name}
        </button>
        {service.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{service.description}</p>
        )}
      </div>

      {/* Active days */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {[1,2,3,4,5,6,7].map((d) => (
          <span
            key={d}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
              activeDays.includes(d)
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'bg-gray-100 text-gray-300'
            }`}
          >
            {DAY_SHORT[d]}
          </span>
        ))}
      </div>

      {/* Duration + timezone */}
      <div className="hidden lg:flex flex-col items-end gap-0.5 text-xs text-gray-400 shrink-0 w-40">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />{service.slotDurationMinutes} min por slot
        </span>
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" />{service.timezone.replace('America/', '')}
        </span>
      </div>

      {/* Toggle */}
      <button
        role="switch"
        aria-checked={service.isActive}
        onClick={onToggle}
        disabled={toggling}
        title={service.isActive ? 'Desactivar' : 'Activar'}
        className="shrink-0 flex items-center gap-2 disabled:opacity-50 group"
      >
        <span className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${
          service.isActive ? 'bg-blue-600' : 'bg-gray-200'
        }`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            service.isActive ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </span>
        <span className={`text-xs font-medium w-14 ${service.isActive ? 'text-blue-600' : 'text-gray-400'}`}>
          {service.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </button>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1">
        {service.isActive && (
          <Button size="sm" variant="outline" onClick={onBook}
            className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-400">
            <CalendarPlus className="h-3.5 w-3.5" />
            Reservar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onView} className="gap-1.5" title="Ver detalle">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          title="Eliminar evento">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

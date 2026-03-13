'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
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

const classSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  timezone: z.string().min(1, 'Timezone requerido'),
  slotDurationMinutes: z.coerce.number().min(5).max(480),
  capacity: z.coerce.number().min(1, 'Mínimo 1 cupo'),
  days: z.array(z.number()).min(1, 'Selecciona al menos un día'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});
type ClassForm = z.infer<typeof classSchema>;

const DEFAULT_VALUES: ClassForm = {
  name: '',
  description: '',
  timezone: 'America/Santiago',
  slotDurationMinutes: 60,
  capacity: 5,
  days: [],
  startTime: '08:00',
  endTime: '09:00',
  validFrom: todayAsString(),
  validUntil: '',
};

export default function ClassesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const selectedDays = watch('days');

  const openCreate = () => {
    reset(DEFAULT_VALUES);
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (svc: Service) => {
    reset({
      name: svc.name,
      description: svc.description ?? '',
      timezone: svc.timezone,
      slotDurationMinutes: svc.slotDurationMinutes,
      capacity: 5,
      days: [],
      startTime: '08:00',
      endTime: '09:00',
      validFrom: todayAsString(),
      validUntil: '',
    });
    setEditing(svc);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ClassForm) => {
      let serviceId: number;

      if (editing) {
        // Update service basic info
        await servicesApi.update(editing.id, {
          name: data.name,
          description: data.description,
          timezone: data.timezone,
          slotDurationMinutes: data.slotDurationMinutes,
        });
        serviceId = editing.id;
      } else {
        // 1. Create service
        const svc = await servicesApi.create({
          name: data.name,
          description: data.description,
          timezone: data.timezone,
          slotDurationMinutes: data.slotDurationMinutes,
        });
        serviceId = svc.id;

        // 2. Create schedule rules + blocks for each selected day
        for (const day of data.days) {
          await rulesApi.create(serviceId, {
            dayOfWeek: day,
            startTime: data.startTime,
            endTime: data.endTime,
            validFrom: data.validFrom || undefined,
            validUntil: data.validUntil || undefined,
          });
          await blocksApi.create(serviceId, {
            dayOfWeek: day,
            startTime: data.startTime,
            endTime: data.endTime,
            capacity: data.capacity,
          });
        }
      }

      return serviceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(editing ? 'Clase actualizada' : 'Clase creada exitosamente');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await servicesApi.update(id, { isActive: false });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Clase desactivada');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clases</h1>
          <p className="text-gray-500 text-sm mt-1">
            Crea y administra los tipos de clase con sus horarios y capacidades.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva clase
        </Button>
      </div>

      {!services?.length ? (
        <EmptyState
          title="Sin clases"
          description="Crea tu primera clase configurando su horario, días y capacidad."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva clase
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <ClassCard
              key={svc.id}
              service={svc}
              onEdit={() => openEdit(svc)}
              onDelete={() => setDeleting(svc)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar: ${editing.name}` : 'Nueva clase'}
        description={
          editing
            ? 'Modifica los datos básicos de la clase. Para editar horarios usa la pestaña de Horarios.'
            : 'Configura el nombre, duración, días y capacidad de la nueva clase.'
        }
        className="max-w-2xl"
      >
        <form
          onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
          className="space-y-5"
        >
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nombre de la clase *</Label>
              <Input {...register('name')} className="mt-1" placeholder="ej: Spinning, Yoga, Pilates" />
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
                type="number"
                min={5}
                max={480}
                {...register('slotDurationMinutes')}
                className="mt-1"
                placeholder="60"
              />
              {errors.slotDurationMinutes && (
                <p className="text-xs text-red-500 mt-1">{errors.slotDurationMinutes.message}</p>
              )}
            </div>
          </div>

          {!editing && (
            <>
              <hr className="border-gray-100" />
              <p className="text-sm font-medium text-gray-700">Horario de la clase</p>

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
                            onClick={() => {
                              field.onChange(
                                checked
                                  ? field.value.filter((d) => d !== day)
                                  : [...field.value, day],
                              );
                            }}
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

              {/* Times */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Hora inicio *</Label>
                  <Input type="time" {...register('startTime')} className="mt-1" />
                  {errors.startTime && (
                    <p className="text-xs text-red-500 mt-1">{errors.startTime.message}</p>
                  )}
                </div>
                <div>
                  <Label>Hora fin *</Label>
                  <Input type="time" {...register('endTime')} className="mt-1" />
                  {errors.endTime && (
                    <p className="text-xs text-red-500 mt-1">{errors.endTime.message}</p>
                  )}
                </div>
                <div>
                  <Label>Capacidad (cupos) *</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register('capacity')}
                    className="mt-1"
                    placeholder="5"
                  />
                  {errors.capacity && (
                    <p className="text-xs text-red-500 mt-1">{errors.capacity.message}</p>
                  )}
                </div>
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
              {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear clase'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Desactivar clase"
        description={`¿Desactivar "${deleting?.name}"? La clase quedará inactiva y no generará disponibilidad.`}
        confirmLabel="Desactivar"
      />
    </div>
  );
}

// ─── Class Card Component ─────────────────────────────────────────────────────

function ClassCard({
  service,
  onEdit,
  onDelete,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: rules } = useQuery({
    queryKey: ['rules', service.id],
    queryFn: () => rulesApi.list(service.id),
  });

  const activeDays = Array.from(new Set(rules?.filter((r) => r.isActive).map((r) => r.dayOfWeek) ?? [])).sort();
  const sampleRule = rules?.find((r) => r.isActive);

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
          {service.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span>{service.slotDurationMinutes} min · {service.timezone}</span>
        </div>
        {sampleRule && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>
              {sampleRule.startTime.substring(0, 5)}–{sampleRule.endTime.substring(0, 5)}
              {sampleRule.validFrom && (
                <span className="text-gray-400"> · desde {sampleRule.validFrom}</span>
              )}
              {sampleRule.validUntil && (
                <span className="text-gray-400"> hasta {sampleRule.validUntil}</span>
              )}
            </span>
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

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(`/services/${service.id}`, '_blank')}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        >
          Configurar →
        </Button>
      </div>
    </div>
  );
}

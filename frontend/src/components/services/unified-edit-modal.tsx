'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { servicesApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScheduleRulesTab } from './schedule-rules-tab';
import { ScheduleBlocksTab } from './schedule-blocks-tab';
import { ExceptionsTab } from './exceptions-tab';

type Tab = 'general' | 'rules' | 'blocks' | 'exceptions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general',    label: 'General' },
  { id: 'rules',      label: 'Horarios semanales' },
  { id: 'blocks',     label: 'Capacidad por tramo' },
  { id: 'exceptions', label: 'Excepciones' },
];

const TIMEZONES = [
  'America/Santiago', 'America/Buenos_Aires', 'America/Lima',
  'America/Bogota', 'America/Mexico_City', 'America/New_York', 'UTC',
];

const generalSchema = z.object({
  name:                z.string().min(1, 'Nombre requerido'),
  description:         z.string().optional(),
  timezone:            z.string().min(1),
  slotDurationMinutes: z.coerce.number().min(5).max(480),
  maxSpots:            z.coerce.number().min(1, 'Mínimo 1').max(500, 'Máximo 500'),
  namedSpots:          z.boolean(),
  spotLabel:           z.string().optional(),
});
type GeneralForm = z.infer<typeof generalSchema>;

// ─── Unified Edit Modal ────────────────────────────────────────────────────────

export function UnifiedEditModal({
  serviceId,
  onClose,
}: {
  serviceId: string | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const handleClose = () => {
    setActiveTab('general');
    onClose();
  };

  const { data: service } = useQuery({
    queryKey: ['services', serviceId],
    queryFn: () => servicesApi.get(serviceId!),
    enabled: !!serviceId,
  });

  return (
    <Modal
      open={!!serviceId}
      onClose={handleClose}
      title={service?.name ?? 'Editar evento'}
      className="max-w-3xl"
    >
      {/* Tab nav */}
      <div className="flex border-b mb-5 -mt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {serviceId && (
        <>
          {activeTab === 'general' && (
            <GeneralTab
              serviceId={serviceId}
              initialValues={service ? {
                name: service.name,
                description: service.description ?? '',
                timezone: service.timezone,
                slotDurationMinutes: service.slotDurationMinutes,
                maxSpots: service.maxSpots,
                namedSpots: !!service.spotLabel,
                spotLabel: service.spotLabel ?? '',
              } : undefined}
            />
          )}
          {activeTab === 'rules'      && <ScheduleRulesTab  serviceId={serviceId} />}
          {activeTab === 'blocks'     && <ScheduleBlocksTab serviceId={serviceId} />}
          {activeTab === 'exceptions' && <ExceptionsTab     serviceId={serviceId} />}
        </>
      )}
    </Modal>
  );
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({
  serviceId,
  initialValues,
}: {
  serviceId: string;
  initialValues?: GeneralForm;
}) {
  const qc = useQueryClient();

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    values: initialValues,
  });

  const namedSpots = watch('namedSpots');

  const saveMutation = useMutation({
    mutationFn: (data: GeneralForm) =>
      servicesApi.update(serviceId, {
        ...data,
        spotLabel: data.namedSpots ? (data.spotLabel || undefined) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['services', serviceId] });
      toast.success('Evento actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
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

        <div>
          <Label>Cupos máximos por sesión *</Label>
          <Input type="number" min={1} max={500} {...register('maxSpots')} className="mt-1" placeholder="20" />
          <p className="text-xs text-gray-400 mt-0.5">Cambiarlo borra todos los overrides por sesión</p>
          {errors.maxSpots && <p className="text-xs text-red-500 mt-1">{errors.maxSpots.message}</p>}
        </div>

        <div className="col-span-2">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Cupos numerados</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {namedSpots
                  ? 'Los clientes eligen un cupo específico (ej: Bici 1, Bici 2…)'
                  : 'Los clientes reservan sin elegir cupo específico'}
              </p>
            </div>
            <Controller
              name="namedSpots"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    field.value ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    field.value ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              )}
            />
          </div>
          {namedSpots && (
            <div className="mt-2">
              <Input
                {...register('spotLabel')}
                className="mt-1"
                placeholder='Nombre del cupo, ej: "Bici" → muestra "Bici 1", "Bici 2"…'
              />
              <p className="text-xs text-gray-400 mt-0.5">Si se deja vacío, se muestra solo el número</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { blocksApi } from '@/lib/api';
import type { ScheduleBlock } from '@/types';
import { DAY_NAMES, DAY_OPTIONS, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

const blockSchema = z.object({
  dayOfWeek: z.coerce.number().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  capacity: z.coerce.number().min(1, 'Mínimo 1 cupo'),
  isActive: z.boolean().default(true),
});
type BlockForm = z.infer<typeof blockSchema>;

export function ScheduleBlocksTab({ serviceId }: { serviceId: number }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [deleting, setDeleting] = useState<ScheduleBlock | null>(null);

  const { data: blocks, isLoading } = useQuery({
    queryKey: ['schedule-blocks', serviceId],
    queryFn: () => blocksApi.list(serviceId),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BlockForm>({
    resolver: zodResolver(blockSchema),
    defaultValues: { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', capacity: 5, isActive: true },
  });

  const openCreate = () => {
    reset({ dayOfWeek: 1, startTime: '08:00', endTime: '09:00', capacity: 5, isActive: true });
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (b: ScheduleBlock) => {
    reset({
      dayOfWeek: b.dayOfWeek,
      startTime: formatTime(b.startTime),
      endTime: formatTime(b.endTime),
      capacity: b.capacity,
      isActive: b.isActive,
    });
    setEditing(b);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: BlockForm) =>
      editing
        ? blocksApi.update(editing.id, data)
        : blocksApi.create(serviceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-blocks', serviceId] });
      toast.success(editing ? 'Bloque actualizado' : 'Bloque creado');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => blocksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-blocks', serviceId] });
      toast.success('Bloque desactivado');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  // Agrupar por día
  const byDay = Array.from({ length: 7 }, (_, i) => i + 1)
    .map((day) => ({ day, blocks: blocks?.filter((b) => b.dayOfWeek === day) ?? [] }))
    .filter((g) => g.blocks.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Define la capacidad (cupos) para cada tramo horario dentro de cada día de semana.
          Un slot solo es reservable si tiene un bloque configurado.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Agregar tramo
        </Button>
      </div>

      {!blocks?.length ? (
        <EmptyState
          title="Sin bloques de capacidad"
          description="Los bloques definen cuántos cupos hay disponibles en cada tramo horario. Sin bloques, no hay slots reservables."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Agregar primer bloque</Button>}
        />
      ) : (
        <div className="space-y-4">
          {byDay.map(({ day, blocks: dayBlocks }) => (
            <div key={day} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b">
                <span className="font-medium text-gray-700 text-sm">{DAY_NAMES[day]}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b">
                  <tr>
                    {['Tramo', 'Cupos', 'Estado', ''].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-gray-500 text-xs uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dayBlocks.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-800">
                        {formatTime(b.startTime)} – {formatTime(b.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700">
                          <span className="text-blue-500">●</span>
                          {b.capacity} cupos
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={b.isActive ? 'success' : 'muted'}>
                          {b.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(b)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar tramo' : 'Nuevo tramo con capacidad'}
        description="Define el tramo horario y cuántos cupos tiene."
      >
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Día de la semana *</Label>
            <select
              {...register('dayOfWeek')}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Hora inicio *</Label>
              <Input type="time" {...register('startTime')} className="mt-1" />
              {errors.startTime && <p className="text-xs text-red-500 mt-1">{errors.startTime.message}</p>}
            </div>
            <div>
              <Label>Hora fin *</Label>
              <Input type="time" {...register('endTime')} className="mt-1" />
              {errors.endTime && <p className="text-xs text-red-500 mt-1">{errors.endTime.message}</p>}
            </div>
          </div>
          <div>
            <Label>Capacidad (cupos) *</Label>
            <Input type="number" min={1} {...register('capacity')} className="mt-1" />
            {errors.capacity && <p className="text-xs text-red-500 mt-1">{errors.capacity.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="blockActive" {...register('isActive')} className="h-4 w-4 rounded" />
            <Label htmlFor="blockActive">Tramo activo</Label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Desactivar tramo"
        description={`¿Desactivar el tramo ${deleting ? `${formatTime(deleting.startTime)}-${formatTime(deleting.endTime)}` : ''} del ${deleting ? DAY_NAMES[deleting.dayOfWeek] : ''}?`}
        confirmLabel="Desactivar"
      />
    </div>
  );
}

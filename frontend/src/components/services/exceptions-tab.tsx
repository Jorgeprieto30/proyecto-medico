'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { exceptionsApi } from '@/lib/api';
import type { ServiceException } from '@/types';
import { formatTime, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

const exSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isClosed: z.boolean(),
  capacityOverride: z.coerce.number().min(0).optional(),
  reason: z.string().optional(),
});
type ExForm = z.infer<typeof exSchema>;

export function ExceptionsTab({ serviceId }: { serviceId: string }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceException | null>(null);
  const [deleting, setDeleting] = useState<ServiceException | null>(null);

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['exceptions', serviceId],
    queryFn: () => exceptionsApi.list(serviceId),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ExForm>({
    resolver: zodResolver(exSchema),
    defaultValues: { isClosed: true },
  });

  const isClosed = watch('isClosed');

  const openCreate = () => {
    reset({ exceptionDate: '', startTime: '', endTime: '', isClosed: true, reason: '' });
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (ex: ServiceException) => {
    reset({
      exceptionDate: ex.exceptionDate,
      startTime: ex.startTime ? formatTime(ex.startTime) : '',
      endTime: ex.endTime ? formatTime(ex.endTime) : '',
      isClosed: ex.isClosed,
      capacityOverride: ex.capacityOverride ?? undefined,
      reason: ex.reason ?? '',
    });
    setEditing(ex);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: ExForm) => {
      const payload = {
        ...data,
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,
        capacityOverride: data.capacityOverride !== undefined ? Number(data.capacityOverride) : undefined,
        reason: data.reason || undefined,
      };
      return editing
        ? exceptionsApi.update(editing.id, payload)
        : exceptionsApi.create(serviceId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exceptions', serviceId] });
      toast.success(editing ? 'Excepción actualizada' : 'Excepción creada');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => exceptionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exceptions', serviceId] });
      toast.success('Excepción eliminada');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  const getExceptionLabel = (ex: ServiceException) => {
    if (ex.isClosed && !ex.startTime) return 'Día cerrado';
    if (ex.isClosed) return `Cerrado ${formatTime(ex.startTime!)}–${formatTime(ex.endTime!)}`;
    if (ex.capacityOverride !== null) return `Capacidad especial: ${ex.capacityOverride} cupos`;
    return 'Modificación de horario';
  };

  const getExceptionVariant = (ex: ServiceException): 'danger' | 'warning' | 'default' => {
    if (ex.isClosed) return 'danger';
    if (ex.capacityOverride !== null) return 'warning';
    return 'default';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Las excepciones permiten cerrar días, bloquear tramos o cambiar la capacidad para fechas específicas.
          Siempre tienen prioridad sobre las reglas semanales.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Agregar excepción
        </Button>
      </div>

      {!exceptions?.length ? (
        <EmptyState
          title="Sin excepciones"
          description="Agrega excepciones para feriados, cierres puntuales o cambios de capacidad en fechas específicas."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Agregar excepción</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Fecha', 'Tramo', 'Tipo', 'Razón', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {exceptions.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ex.exceptionDate}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">
                    {ex.startTime && ex.endTime
                      ? `${formatTime(ex.startTime)}–${formatTime(ex.endTime)}`
                      : 'Día completo'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getExceptionVariant(ex)}>
                      {getExceptionLabel(ex)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {ex.reason ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ex)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(ex)}
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
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar excepción' : 'Nueva excepción'}
        description="Define un cierre, bloqueo o cambio de capacidad para una fecha específica."
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Fecha *</Label>
            <Input type="date" {...register('exceptionDate')} className="mt-1" />
            {errors.exceptionDate && <p className="text-xs text-red-500 mt-1">{errors.exceptionDate.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Hora inicio (opcional)</Label>
              <Input type="time" {...register('startTime')} className="mt-1" />
              <p className="text-xs text-gray-400 mt-0.5">Vacío = aplica al día completo</p>
            </div>
            <div>
              <Label>Hora fin (opcional)</Label>
              <Input type="time" {...register('endTime')} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isClosed" {...register('isClosed')} className="h-4 w-4 rounded" />
            <Label htmlFor="isClosed">Cerrar / bloquear este período</Label>
          </div>

          {!isClosed && (
            <div>
              <Label>Override de capacidad (cupos)</Label>
              <Input type="number" min={0} {...register('capacityOverride')} className="mt-1"
                placeholder="Ej: 2 (deja vacío para no cambiar)" />
              <p className="text-xs text-gray-400 mt-0.5">
                Si is_closed=false, puedes cambiar la capacidad de ese tramo.
              </p>
            </div>
          )}

          <div>
            <Label>Razón / comentario</Label>
            <Input {...register('reason')} className="mt-1" placeholder="Ej: Feriado nacional" />
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
        title="Eliminar excepción"
        description={`¿Eliminar la excepción del ${deleting?.exceptionDate}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}

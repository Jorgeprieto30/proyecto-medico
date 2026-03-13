'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { rulesApi } from '@/lib/api';
import type { ScheduleRule } from '@/types';
import { DAY_NAMES, DAY_OPTIONS, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

const ruleSchema = z.object({
  dayOfWeek: z.coerce.number().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  isActive: z.boolean().default(true),
});
type RuleForm = z.infer<typeof ruleSchema>;

export function ScheduleRulesTab({ serviceId }: { serviceId: number }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRule | null>(null);
  const [deleting, setDeleting] = useState<ScheduleRule | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['schedule-rules', serviceId],
    queryFn: () => rulesApi.list(serviceId),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', isActive: true },
  });

  const openCreate = () => {
    reset({ dayOfWeek: 1, startTime: '08:00', endTime: '18:00', isActive: true });
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (r: ScheduleRule) => {
    reset({
      dayOfWeek: r.dayOfWeek,
      startTime: formatTime(r.startTime),
      endTime: formatTime(r.endTime),
      isActive: r.isActive,
    });
    setEditing(r);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: RuleForm) =>
      editing
        ? rulesApi.update(editing.id, data)
        : rulesApi.create(serviceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-rules', serviceId] });
      toast.success(editing ? 'Regla actualizada' : 'Regla creada');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-rules', serviceId] });
      toast.success('Regla desactivada');
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  // Agrupar por día
  const byDay = Array.from({ length: 7 }, (_, i) => i + 1).map((day) => ({
    day,
    rules: rules?.filter((r) => r.dayOfWeek === day) ?? [],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Define qué días y en qué horario opera el servicio (día de semana + hora inicio/fin).
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Agregar regla
        </Button>
      </div>

      {!rules?.length ? (
        <EmptyState
          title="Sin reglas configuradas"
          description="Agrega reglas para definir los días y horarios de atención del servicio."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Agregar primera regla</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Día', 'Hora inicio', 'Hora fin', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{DAY_NAMES[r.dayOfWeek]}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(r.startTime)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(r.endTime)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.isActive ? 'success' : 'muted'}>
                      {r.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}
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
        title={editing ? 'Editar regla' : 'Nueva regla semanal'}
        description="Define un día de la semana y el horario de atención."
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
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ruleActive" {...register('isActive')} className="h-4 w-4 rounded" />
            <Label htmlFor="ruleActive">Regla activa</Label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Desactivar regla"
        description={`¿Desactivar la regla del ${deleting ? DAY_NAMES[deleting.dayOfWeek] : ''}? No se elimina, solo se desactiva.`}
        confirmLabel="Desactivar"
      />
    </div>
  );
}

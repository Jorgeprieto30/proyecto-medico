'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { servicesApi } from '@/lib/api';
import type { Service } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  timezone: z.string().min(1, 'La zona horaria es requerida'),
  slotDurationMinutes: z.coerce.number().min(5).max(480),
  isActive: z.boolean().default(true),
});
type ServiceForm = z.infer<typeof serviceSchema>;

const TIMEZONES = [
  'America/Santiago',
  'America/Bogota',
  'America/Lima',
  'America/Buenos_Aires',
  'America/Mexico_City',
  'UTC',
];

export default function ServicesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { isActive: true, slotDurationMinutes: 60, timezone: 'America/Santiago' },
  });

  const openCreate = () => {
    reset({ name: '', description: '', timezone: 'America/Santiago', slotDurationMinutes: 60, isActive: true });
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    reset({
      name: s.name,
      description: s.description ?? '',
      timezone: s.timezone,
      slotDurationMinutes: s.slotDurationMinutes,
      isActive: s.isActive,
    });
    setEditing(s);
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: ServiceForm) =>
      editing
        ? servicesApi.update(editing.id, data)
        : servicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(editing ? 'Servicio actualizado' : 'Servicio creado');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: Service) =>
      servicesApi.update(s.id, { isActive: !s.isActive }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(updated.isActive ? 'Servicio activado' : 'Servicio desactivado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servicio eliminado');
      setDeleteId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona los servicios del sistema</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!services?.length ? (
            <EmptyState
              title="No hay servicios"
              description="Crea el primer servicio para comenzar a configurar horarios y reservas."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Crear servicio</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['ID', 'Nombre', 'Zona horaria', 'Bloque (min)', 'Activo', 'Acciones'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{s.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      {s.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.timezone}</td>
                    <td className="px-4 py-3 text-gray-600">{s.slotDurationMinutes}</td>
                    <td className="px-4 py-3">
                      {/* Toggle switch */}
                      <button
                        role="switch"
                        aria-checked={s.isActive}
                        onClick={() => toggleMutation.mutate(s)}
                        disabled={toggleMutation.isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${
                          s.isActive ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            s.isActive ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/services/${s.id}`}>
                            <Eye className="h-3 w-3" />
                            Detalle
                          </Link>
                        </Button>
                        {!s.isActive && (
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                            title="Eliminar servicio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar servicio' : 'Nuevo servicio'}
      >
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register('name')} className="mt-1" placeholder="Clase de Spinning" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" {...register('description')} className="mt-1" placeholder="Descripción opcional" />
          </div>

          <div>
            <Label htmlFor="timezone">Zona horaria *</Label>
            <select
              id="timezone"
              {...register('timezone')}
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            {errors.timezone && <p className="text-xs text-red-500 mt-1">{errors.timezone.message}</p>}
          </div>

          <div>
            <Label htmlFor="slot">Duración del bloque (minutos) *</Label>
            <Input
              id="slot"
              type="number"
              min={5}
              max={480}
              {...register('slotDurationMinutes')}
              className="mt-1"
            />
            {errors.slotDurationMinutes && <p className="text-xs text-red-500 mt-1">{errors.slotDurationMinutes.message}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" {...register('isActive')} className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="isActive">Servicio activo</Label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear servicio'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm eliminar */}
      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar servicio"
        description="Esta acción es permanente. Se eliminará el servicio y toda su configuración de horarios. Las reservas existentes no se verán afectadas."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

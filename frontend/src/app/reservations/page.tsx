'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, CalendarCheck, Clock, XCircle, Plus, X, Activity } from 'lucide-react';

import { servicesApi, reservationsApi } from '@/lib/api';
import type { Reservation } from '@/types';
import { formatDateTime, getStatusLabel, todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function changeDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short',
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const qc = useQueryClient();
  const today = todayAsString();

  const [rangeDays, setRangeDays] = useState(30);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);

  const rangeStart = changeDate(today, -rangeDays + 1);

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  // Fetch all reservations (no date filter so we can compute stats)
  const { data: allReservations, isLoading } = useQuery({
    queryKey: ['reservations-all'],
    queryFn: () => reservationsApi.list({}),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reservationsApi.cancel(id),
    onSuccess: () => {
      toast.success('Reserva cancelada');
      qc.invalidateQueries({ queryKey: ['reservations-all'] });
      setCancelling(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Derived stats ────────────────────────────────────────────────────────────

  const inRange = useMemo(() => {
    if (!allReservations) return [];
    return allReservations.filter((r) => {
      const d = r.slotStart.split('T')[0];
      return d >= rangeStart && d <= today;
    });
  }, [allReservations, rangeStart, today]);

  const stats = useMemo(() => {
    const confirmed  = inRange.filter((r) => r.status === 'confirmed').length;
    const pending    = inRange.filter((r) => r.status === 'pending').length;
    const cancelled  = inRange.filter((r) => r.status === 'cancelled').length;
    return { total: inRange.length, confirmed, pending, cancelled };
  }, [inRange]);

  // Reservations per service
  const byService = useMemo(() => {
    const map: Record<string, number> = {};
    inRange.forEach((r) => {
      if (r.status !== 'cancelled') map[r.serviceId] = (map[r.serviceId] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([serviceId, count]) => ({
        serviceId,
        name: services?.find((s) => s.id === serviceId)?.name ?? 'Desconocido',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [inRange, services]);

  // Reservations per day (last 14 days for the bar chart)
  const last14 = useMemo(() => {
    const chartStart = changeDate(today, -13);
    const days = Array.from({ length: 14 }, (_, i) => changeDate(chartStart, i));
    return days.map((d) => ({
      date: d,
      count: inRange.filter((r) => r.slotStart.startsWith(d) && r.status !== 'cancelled').length,
    }));
  }, [inRange, today]);

  const maxCount = Math.max(...last14.map((d) => d.count), 1);

  // Recent activity (last 20, sorted by slotStart desc)
  const recent = useMemo(() => {
    return [...(inRange)]
      .sort((a, b) => b.slotStart.localeCompare(a.slotStart))
      .slice(0, 20);
  }, [inRange]);

  const canCancel = (r: Reservation) => r.status === 'confirmed' || r.status === 'pending';

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividad</h1>
          <p className="text-gray-500 text-sm mt-1">Historial y estadísticas de reservas.</p>
        </div>
        <Button onClick={() => window.location.href = '/reservations/new'} className="hidden">
          <Plus className="h-4 w-4" />
          Nueva reserva
        </Button>
      </div>

      {/* Range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Mostrar últimos:</span>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setRangeDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              rangeDays === d
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {d} días
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total reservas" value={stats.total} icon={Activity} color="bg-blue-500" sub={`últimos ${rangeDays} días`} />
        <StatCard label="Confirmadas" value={stats.confirmed} icon={CalendarCheck} color="bg-green-500" />
        <StatCard label="Pendientes" value={stats.pending} icon={Clock} color="bg-orange-400" />
        <StatCard label="Canceladas" value={stats.cancelled} icon={XCircle} color="bg-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily bar chart */}
        <div className="lg:col-span-2 bg-white border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Reservas por día (últimos 14 días)
          </h2>
          <div className="flex items-end gap-1 h-32">
            {last14.map(({ date, count }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{count > 0 ? count : ''}</span>
                <div
                  className="w-full rounded-t-sm bg-blue-500 transition-all"
                  style={{ height: `${(count / maxCount) * 96}px`, minHeight: count > 0 ? 4 : 2, opacity: count > 0 ? 1 : 0.15 }}
                />
                <span className="text-xs text-gray-400 -rotate-45 origin-top-left translate-y-3 translate-x-1">
                  {new Date(date + 'T12:00:00').getDate()}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-center mt-6">
            {new Date(last14[0].date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(last14[13].date + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        {/* By service */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Por evento</h2>
          {byService.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="space-y-3">
              {byService.map(({ serviceId, name, count }) => {
                const pct = Math.round((count / (stats.total - stats.cancelled || 1)) * 100);
                return (
                  <div key={serviceId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate">{name}</span>
                      <span className="font-medium text-gray-900 shrink-0 ml-2">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Actividad reciente</h2>
          <span className="text-xs text-gray-400">{recent.length} reservas en el período</span>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No hay actividad en los últimos {rangeDays} días.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Evento', 'Cliente', 'RUT', 'Fecha', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">#{r.id}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {services?.find((s) => s.id === r.serviceId)?.name ?? `#${r.serviceId}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.customerName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.customerExternalId ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(r.slotStart)}</td>
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
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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

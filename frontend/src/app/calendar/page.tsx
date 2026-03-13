'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

import { servicesApi, availabilityApi } from '@/lib/api';
import type { SlotAvailability, Service } from '@/types';
import { todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_START_HOUR = 6;   // 06:00
const DAY_END_HOUR   = 22;  // 22:00
const HOUR_HEIGHT_PX = 64;  // px per hour
const TOTAL_HEIGHT   = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX;

const COLORS = [
  { bg: 'bg-blue-500',   light: 'bg-blue-50 border-blue-200 text-blue-900' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  { bg: 'bg-violet-500', light: 'bg-violet-50 border-violet-200 text-violet-900' },
  { bg: 'bg-orange-500', light: 'bg-orange-50 border-orange-200 text-orange-900' },
  { bg: 'bg-pink-500',   light: 'bg-pink-50 border-pink-200 text-pink-900' },
  { bg: 'bg-teal-500',   light: 'bg-teal-50 border-teal-200 text-teal-900' },
];

const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesSinceStart(isoStr: string, tz?: string): number {
  const d = new Date(isoStr);
  const local = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: 'numeric', hour12: false, timeZone: tz ?? 'UTC',
  }).format(d);
  const [h, m] = local.split(':').map(Number);
  return (h - DAY_START_HOUR) * 60 + m;
}

function formatHHMM(isoStr: string, tz?: string): string {
  return new Date(isoStr).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit', timeZone: tz ?? 'UTC',
  });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function changeDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarSlot extends SlotAvailability {
  serviceId: number;
  serviceName: string;
  timezone: string;
  colorIdx: number;
  topPx: number;
  heightPx: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [date, setDate] = useState(todayAsString());
  const [filterServiceId, setFilterServiceId] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const activeServices = services.filter((s) => s.isActive);

  // Fetch availability for each service in parallel
  const availabilityQueries = useQuery({
    queryKey: ['calendar', date, activeServices.map((s) => s.id)],
    queryFn: async () => {
      const results = await Promise.all(
        activeServices.map((svc) =>
          availabilityApi.byDate(svc.id, date).then((slots) => ({ svc, slots })).catch(() => ({ svc, slots: [] as SlotAvailability[] })),
        ),
      );
      return results;
    },
    enabled: activeServices.length > 0,
  });

  // Build calendar slots with position info
  const calendarSlots = useMemo<CalendarSlot[]>(() => {
    if (!availabilityQueries.data) return [];
    const all: CalendarSlot[] = [];

    availabilityQueries.data.forEach(({ svc, slots }, svcIdx) => {
      if (filterServiceId > 0 && svc.id !== filterServiceId) return;
      const colorIdx = svcIdx % COLORS.length;

      slots.forEach((slot) => {
        const startMin = minutesSinceStart(slot.slot_start, svc.timezone);
        const endMin   = minutesSinceStart(slot.slot_end, svc.timezone);
        if (startMin < 0 || endMin > (DAY_END_HOUR - DAY_START_HOUR) * 60) return;

        all.push({
          ...slot,
          serviceId: svc.id,
          serviceName: svc.name,
          timezone: svc.timezone,
          colorIdx,
          topPx: (startMin / 60) * HOUR_HEIGHT_PX,
          heightPx: Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT_PX, 28),
        });
      });
    });

    return all;
  }, [availabilityQueries.data, filterServiceId]);

  const isLoading = loadingServices || availabilityQueries.isLoading;

  const hourLabels = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => `${String(DAY_START_HOUR + i).padStart(2, '0')}:00`,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-gray-500 text-sm mt-1">
          Vista diaria de todas las clases y su disponibilidad.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => setDate((d) => changeDate(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
            {formatDateLabel(date)}
          </span>
          <Button size="icon" variant="outline" onClick={() => setDate((d) => changeDate(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" variant="outline" onClick={() => setDate(todayAsString())}>
          Hoy
        </Button>

        <div className="ml-auto w-52">
          <select
            value={filterServiceId}
            onChange={(e) => setFilterServiceId(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value={0}>Todas las clases</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      {activeServices.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {activeServices
            .filter((s) => filterServiceId === 0 || s.id === filterServiceId)
            .map((svc, i) => (
              <div key={svc.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-3 h-3 rounded-full ${COLORS[i % COLORS.length].bg}`} />
                {svc.name}
              </div>
            ))}
        </div>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : (
        /* Calendar grid */
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="flex">
            {/* Time gutter */}
            <div className="w-16 shrink-0 border-r border-gray-100 relative" style={{ height: TOTAL_HEIGHT + HOUR_HEIGHT_PX }}>
              {hourLabels.map((label, i) => (
                <div
                  key={label}
                  className="absolute right-2 text-xs text-gray-400 -translate-y-2"
                  style={{ top: i * HOUR_HEIGHT_PX }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div className="flex-1 relative" style={{ height: TOTAL_HEIGHT }}>
              {/* Hour lines */}
              {hourLabels.slice(0, -1).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: i * HOUR_HEIGHT_PX }}
                />
              ))}

              {/* Half-hour lines */}
              {hourLabels.slice(0, -1).map((_, i) => (
                <div
                  key={`h${i}`}
                  className="absolute left-0 right-0 border-t border-dashed border-gray-50"
                  style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                />
              ))}

              {/* Slots */}
              {calendarSlots.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                  Sin clases para este día
                </div>
              ) : (
                calendarSlots.map((slot, idx) => {
                  const color = COLORS[slot.colorIdx];
                  const pct = slot.capacity > 0 ? (slot.available / slot.capacity) * 100 : 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] ${color.light}`}
                      style={{ top: slot.topPx + 1, height: slot.heightPx - 2 }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold leading-tight truncate">
                          {slot.serviceName}
                        </span>
                        <span className={`shrink-0 text-xs font-bold ${slot.available === 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {slot.available}/{slot.capacity}
                        </span>
                      </div>
                      {slot.heightPx > 36 && (
                        <div className="text-xs opacity-70 mt-0.5 leading-tight">
                          {formatHHMM(slot.slot_start, slot.timezone)}–{formatHHMM(slot.slot_end, slot.timezone)}
                        </div>
                      )}
                      {slot.heightPx > 52 && (
                        <div className="mt-1 h-1 bg-black/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-current opacity-50"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slot detail modal */}
      <Modal
        open={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title={selectedSlot?.serviceName ?? ''}
        description={
          selectedSlot
            ? `${formatDateLabel(date)} · ${formatHHMM(selectedSlot.slot_start, selectedSlot.timezone)}–${formatHHMM(selectedSlot.slot_end, selectedSlot.timezone)}`
            : ''
        }
      >
        {selectedSlot && <SlotDetail slot={selectedSlot} />}
      </Modal>
    </div>
  );
}

// ─── Slot Detail ──────────────────────────────────────────────────────────────

function SlotDetail({ slot }: { slot: CalendarSlot }) {
  const pct = slot.capacity > 0 ? (slot.reserved / slot.capacity) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Capacidad" value={slot.capacity} color="text-gray-900" />
        <StatBox label="Reservados" value={slot.reserved} color="text-blue-600" />
        <StatBox
          label="Disponibles"
          value={slot.available}
          color={slot.available > 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Occupancy bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Ocupación</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-green-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-2 text-sm font-medium p-3 rounded-lg ${
        slot.available === 0
          ? 'bg-red-50 text-red-700'
          : slot.available <= 2
          ? 'bg-yellow-50 text-yellow-700'
          : 'bg-green-50 text-green-700'
      }`}>
        <Info className="h-4 w-4 shrink-0" />
        {slot.available === 0
          ? 'Sin cupos disponibles'
          : slot.available <= 2
          ? `¡Últimos ${slot.available} cupo${slot.available > 1 ? 's' : ''}!`
          : `${slot.available} cupos disponibles`}
      </div>

      {/* Times */}
      <div className="text-sm text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Inicio</span>
          <span className="font-medium">{formatHHMM(slot.slot_start, slot.timezone)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fin</span>
          <span className="font-medium">{formatHHMM(slot.slot_end, slot.timezone)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Zona horaria</span>
          <span className="font-medium">{slot.timezone}</span>
        </div>
      </div>

      {slot.bookable && (
        <Button
          className="w-full"
          onClick={() => {
            window.location.href = `/availability?service_id=${slot.serviceId}`;
          }}
        >
          Ir a reservar →
        </Button>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

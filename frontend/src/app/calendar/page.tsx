'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

import { servicesApi, availabilityApi } from '@/lib/api';
import type { SlotAvailability } from '@/types';
import { todayAsString } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_START_HOUR = 6;
const DAY_END_HOUR   = 22;
const HOUR_HEIGHT_PX = 64;
const TOTAL_HEIGHT   = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX;

const COLORS = [
  { bg: 'bg-blue-500',    light: 'bg-blue-50 border-blue-200 text-blue-900' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  { bg: 'bg-violet-500',  light: 'bg-violet-50 border-violet-200 text-violet-900' },
  { bg: 'bg-orange-500',  light: 'bg-orange-50 border-orange-200 text-orange-900' },
  { bg: 'bg-pink-500',    light: 'bg-pink-50 border-pink-200 text-pink-900' },
  { bg: 'bg-teal-500',    light: 'bg-teal-50 border-teal-200 text-teal-900' },
];

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MONTH_NAMES_LOWER = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

type ViewMode = 'day' | 'week' | 'year';

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
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES_LOWER[d.getMonth()]} ${d.getFullYear()}`;
}

function changeDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Returns the ISO date string of Monday of the week containing dateStr */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/** Returns array of 7 date strings (Mon–Sun) for the week containing dateStr */
function getWeekDays(dateStr: string): string[] {
  const mon = getWeekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => changeDate(mon, i));
}

/** Returns days-in-month for a given year/month (0-based month) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns day-of-week (0=Sun) for the 1st of year/month */
function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarSlot extends SlotAvailability {
  serviceId: string;
  serviceName: string;
  timezone: string;
  colorIdx: number;
  topPx: number;
  heightPx: number;
}

interface LaidOutSlot extends CalendarSlot {
  col: number;
  totalCols: number;
}

/**
 * Assigns non-overlapping column indices to slots so they can be rendered
 * side-by-side instead of stacking on top of each other.
 */
function layoutSlots(slots: CalendarSlot[]): LaidOutSlot[] {
  const sorted = [...slots].sort((a, b) => a.topPx - b.topPx);
  const result: LaidOutSlot[] = sorted.map((s) => ({ ...s, col: 0, totalCols: 1 }));

  // Greedy column assignment
  const columns: LaidOutSlot[][] = [];
  for (const slot of result) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const last = columns[c][columns[c].length - 1];
      if (last.topPx + last.heightPx <= slot.topPx) {
        slot.col = c;
        columns[c].push(slot);
        placed = true;
        break;
      }
    }
    if (!placed) {
      slot.col = columns.length;
      columns.push([slot]);
    }
  }

  // Determine totalCols: max col+1 among all mutually overlapping slots
  for (const slot of result) {
    let maxCol = slot.col;
    for (const other of result) {
      if (other === slot) continue;
      const overlapEnd = Math.min(slot.topPx + slot.heightPx, other.topPx + other.heightPx);
      if (overlapEnd > Math.max(slot.topPx, other.topPx)) {
        maxCol = Math.max(maxCol, other.col);
      }
    }
    slot.totalCols = maxCol + 1;
  }

  return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [date, setDate]           = useState(todayAsString());
  const [view, setView]           = useState<ViewMode>('day');
  const [filterServiceId, setFilterServiceId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const activeServices = services.filter((s) => s.isActive);

  // Dates to fetch: 1 for day, 7 for week
  const datesToFetch = useMemo(() => {
    if (view === 'week') return getWeekDays(date);
    if (view === 'day')  return [date];
    return [];
  }, [view, date]);

  const availabilityQuery = useQuery({
    queryKey: ['calendar', datesToFetch, activeServices.map((s) => s.id), filterServiceId],
    queryFn: async () => {
      const servicesToFetch = filterServiceId
        ? activeServices.filter((s) => s.id === filterServiceId)
        : activeServices;

      const results: Record<string, CalendarSlot[]> = {};
      await Promise.all(
        datesToFetch.map(async (d) => {
          const daySlots: CalendarSlot[] = [];
          await Promise.all(
            servicesToFetch.map(async (svc, svcIdx) => {
              const colorIdx = activeServices.findIndex((s) => s.id === svc.id) % COLORS.length;
              try {
                const slots = await availabilityApi.byDate(svc.id, d);
                slots.forEach((slot) => {
                  const startMin = minutesSinceStart(slot.slot_start, svc.timezone);
                  const endMin   = minutesSinceStart(slot.slot_end, svc.timezone);
                  if (startMin < 0 || endMin > (DAY_END_HOUR - DAY_START_HOUR) * 60) return;
                  daySlots.push({
                    ...slot,
                    serviceId: svc.id,
                    serviceName: svc.name,
                    timezone: svc.timezone,
                    colorIdx,
                    topPx: (startMin / 60) * HOUR_HEIGHT_PX,
                    heightPx: Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT_PX, 28),
                  });
                });
              } catch { /* ignore */ }
            }),
          );
          results[d] = daySlots;
        }),
      );
      return results;
    },
    enabled: activeServices.length > 0 && datesToFetch.length > 0,
  });

  const isLoading = loadingServices || availabilityQuery.isLoading;

  const hourLabels = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => `${String(DAY_START_HOUR + i).padStart(2, '0')}:00`,
  );

  // Navigation helpers
  const navigatePrev = () => {
    if (view === 'day')  setDate((d) => changeDate(d, -1));
    if (view === 'week') setDate((d) => changeDate(d, -7));
    if (view === 'year') {
      const d = new Date(date + 'T12:00:00');
      d.setFullYear(d.getFullYear() - 1);
      setDate(d.toISOString().split('T')[0]);
    }
  };
  const navigateNext = () => {
    if (view === 'day')  setDate((d) => changeDate(d, 1));
    if (view === 'week') setDate((d) => changeDate(d, 7));
    if (view === 'year') {
      const d = new Date(date + 'T12:00:00');
      d.setFullYear(d.getFullYear() + 1);
      setDate(d.toISOString().split('T')[0]);
    }
  };

  const navLabel = useMemo(() => {
    if (view === 'day') return formatDateLabel(date);
    if (view === 'week') {
      const days = getWeekDays(date);
      const first = new Date(days[0] + 'T12:00:00');
      const last  = new Date(days[6] + 'T12:00:00');
      return `${first.getDate()} ${MONTH_NAMES_LOWER[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES_LOWER[last.getMonth()]} ${last.getFullYear()}`;
    }
    const d = new Date(date + 'T12:00:00');
    return String(d.getFullYear());
  }, [view, date]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-gray-500 text-sm mt-1">Vista de reservas y disponibilidad.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View switcher */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['day', 'week', 'year'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                view === v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Año'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[220px] text-center">
            {navLabel}
          </span>
          <Button size="icon" variant="outline" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" variant="outline" onClick={() => setDate(todayAsString())}>
          Hoy
        </Button>

        {view !== 'year' && (
          <div className="ml-auto w-52">
            <select
              value={filterServiceId}
              onChange={(e) => setFilterServiceId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">Todas las clases</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Legend */}
      {view !== 'year' && activeServices.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {activeServices
            .filter((s) => !filterServiceId || s.id === filterServiceId)
            .map((svc, i) => (
              <div key={svc.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-3 h-3 rounded-full ${COLORS[i % COLORS.length].bg}`} />
                {svc.name}
              </div>
            ))}
        </div>
      )}

      {/* Views */}
      {view === 'year' ? (
        <YearView
          date={date}
          onSelectDate={(d) => { setDate(d); setView('day'); }}
        />
      ) : isLoading ? (
        <PageSpinner />
      ) : view === 'day' ? (
        <DayView
          date={date}
          slots={availabilityQuery.data?.[date] ?? []}
          hourLabels={hourLabels}
          onSelectSlot={setSelectedSlot}
        />
      ) : (
        <WeekView
          weekDays={getWeekDays(date)}
          slotsByDate={availabilityQuery.data ?? {}}
          hourLabels={hourLabels}
          onSelectSlot={setSelectedSlot}
          onSelectDate={(d) => { setDate(d); setView('day'); }}
        />
      )}

      {/* Slot detail modal */}
      <Modal
        open={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title={selectedSlot?.serviceName ?? ''}
        description={
          selectedSlot
            ? `${formatDateLabel(selectedSlot.slot_start.split('T')[0])} · ${formatHHMM(selectedSlot.slot_start, selectedSlot.timezone)}–${formatHHMM(selectedSlot.slot_end, selectedSlot.timezone)}`
            : ''
        }
      >
        {selectedSlot && <SlotDetail slot={selectedSlot} />}
      </Modal>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  date,
  slots,
  hourLabels,
  onSelectSlot,
}: {
  date: string;
  slots: CalendarSlot[];
  hourLabels: string[];
  onSelectSlot: (s: CalendarSlot) => void;
}) {
  const laid = layoutSlots(slots);

  return (
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

        {/* Grid */}
        <div className="flex-1 relative" style={{ height: TOTAL_HEIGHT }}>
          {hourLabels.slice(0, -1).map((_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_HEIGHT_PX }} />
          ))}
          {hourLabels.slice(0, -1).map((_, i) => (
            <div key={`h${i}`} className="absolute left-0 right-0 border-t border-dashed border-gray-50" style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }} />
          ))}

          {laid.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Sin clases para este día
            </div>
          ) : (
            laid.map((slot, idx) => {
              const color = COLORS[slot.colorIdx];
              const pct = slot.capacity > 0 ? (slot.available / slot.capacity) * 100 : 0;
              const GAP = 2; // px gap between columns
              const colW = 100 / slot.totalCols;
              const leftPct = slot.col * colW;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectSlot(slot)}
                  className={`absolute rounded-lg border px-2 py-1 text-left overflow-hidden transition-all hover:shadow-md hover:z-10 ${color.light}`}
                  style={{
                    top: slot.topPx + 1,
                    height: slot.heightPx - 2,
                    left: `calc(${leftPct}% + ${GAP}px)`,
                    width: `calc(${colW}% - ${GAP * 2}px)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-semibold leading-tight truncate">{slot.serviceName}</span>
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
                      <div className="h-full rounded-full bg-current opacity-50" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  weekDays,
  slotsByDate,
  hourLabels,
  onSelectSlot,
  onSelectDate,
}: {
  weekDays: string[];
  slotsByDate: Record<string, CalendarSlot[]>;
  hourLabels: string[];
  onSelectSlot: (s: CalendarSlot) => void;
  onSelectDate: (d: string) => void;
}) {
  const today = todayAsString();

  return (
    <div className="border rounded-xl overflow-hidden bg-white overflow-x-auto">
      {/* Day headers */}
      <div className="flex border-b bg-gray-50">
        <div className="w-16 shrink-0 border-r border-gray-100" />
        {weekDays.map((d) => {
          const jsDate = new Date(d + 'T12:00:00');
          const isToday = d === today;
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className="flex-1 min-w-[80px] py-2 text-center hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs text-gray-500 block">{WEEKDAY_SHORT[jsDate.getDay()]}</span>
              <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
              }`}>
                {jsDate.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid body */}
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

        {/* 7 day columns */}
        {weekDays.map((d) => {
          const laid = layoutSlots(slotsByDate[d] ?? []);
          return (
            <div key={d} className="flex-1 min-w-[80px] relative border-l border-gray-50" style={{ height: TOTAL_HEIGHT }}>
              {/* Hour lines */}
              {hourLabels.slice(0, -1).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * HOUR_HEIGHT_PX }} />
              ))}
              {/* Slots */}
              {laid.map((slot, idx) => {
                const color = COLORS[slot.colorIdx];
                const GAP = 1;
                const colW = 100 / slot.totalCols;
                const leftPct = slot.col * colW;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectSlot(slot)}
                    className={`absolute rounded border px-1 text-left overflow-hidden transition-all hover:shadow-md hover:z-10 ${color.light}`}
                    style={{
                      top: slot.topPx + 1,
                      height: slot.heightPx - 2,
                      left: `calc(${leftPct}% + ${GAP}px)`,
                      width: `calc(${colW}% - ${GAP * 2}px)`,
                    }}
                  >
                    <span className="text-xs font-semibold leading-tight truncate block">{slot.serviceName}</span>
                    {slot.heightPx > 32 && (
                      <span className={`text-xs font-bold ${slot.available === 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {slot.available}/{slot.capacity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Year View ────────────────────────────────────────────────────────────────

function YearView({ date, onSelectDate }: { date: string; onSelectDate: (d: string) => void }) {
  const today = todayAsString();
  const year = new Date(date + 'T12:00:00').getFullYear();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, monthIdx) => {
        const numDays = daysInMonth(year, monthIdx);
        const firstDow = firstDayOfMonth(year, monthIdx); // 0=Sun
        // Shift so week starts on Monday: 0=Mon ... 6=Sun
        const offset = firstDow === 0 ? 6 : firstDow - 1;

        return (
          <div key={monthIdx} className="border rounded-xl bg-white p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 text-center">
              {MONTH_NAMES[monthIdx]}
            </h3>
            <div className="grid grid-cols-7 gap-0">
              {['L','M','X','J','V','S','D'].map((d) => (
                <div key={d} className="text-center text-xs text-gray-400 pb-1 font-medium">{d}</div>
              ))}
              {/* Leading empty cells */}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`e${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: numDays }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const isSelected = dateStr === date;
                return (
                  <button
                    key={day}
                    onClick={() => onSelectDate(dateStr)}
                    className={`aspect-square flex items-center justify-center text-xs rounded-full transition-colors hover:bg-blue-50 ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold hover:bg-blue-700'
                        : isSelected
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Slot Detail ──────────────────────────────────────────────────────────────

function SlotDetail({ slot }: { slot: CalendarSlot }) {
  const pct = slot.capacity > 0 ? (slot.reserved / slot.capacity) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Capacidad" value={slot.capacity} color="text-gray-900" />
        <StatBox label="Reservados" value={slot.reserved} color="text-blue-600" />
        <StatBox label="Disponibles" value={slot.available} color={slot.available > 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Ocupación</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

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
          onClick={() => { window.location.href = `/availability?service_id=${slot.serviceId}`; }}
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

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, X, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { getMemberToken, getMemberProfile, type MemberProfile } from '@/lib/member-auth';
import { formatSlotDate, formatSlotTime, todayAsString } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const STRIP_DAYS = 21;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_SHORT_ISO = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface Center {
  id: string;
  center_name: string | null;
  center_code: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  slotDurationMinutes: number;
  maxSpots: number;
  spotLabel: string | null;
  isActive: boolean;
}

interface Slot {
  slot_start: string;
  slot_end: string;
  capacity: number;
  reserved: number;
  available: number;
  bookable: boolean;
}

interface SpotInfo {
  number: number;
  available: boolean;
}

interface SlotSpots {
  service_id: string;
  slot_start: string;
  slot_end: string;
  max_spots: number;
  spot_label: string | null;
  spots: SpotInfo[];
}

type BookingStep = 'date' | 'slot' | 'spot' | 'success';

interface BookingState {
  service: Service;
  date: string;
  slot: Slot | null;
  spotNumber: number | null;
  step: BookingStep;
}

interface ConfirmedReservation {
  date: string;
  slot: Slot;
  spotNumber: number | null;
  spotLabel: string | null;
  timezone: string;
  serviceName: string;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json.data ?? json;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function parseDateStr(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return { weekday: WEEKDAY_SHORT[d.getDay()], day: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className ?? ''}`} />;
}

function CapacityBar({ available, capacity }: { available: number; capacity: number }) {
  const pct = capacity > 0 ? Math.round((available / capacity) * 100) : 0;
  const color = pct === 0 ? 'bg-red-400' : pct <= 25 ? 'bg-orange-400' : pct <= 50 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function UrgencyBadge({ available, capacity }: { available: number; capacity: number }) {
  if (available === 0) return null;
  if (available === 1) return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
      Último cupo
    </span>
  );
  const pct = available / capacity;
  if (pct <= 0.25) return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
      Casi lleno
    </span>
  );
  return null;
}

function buildGoogleCalendarUrl(confirmed: ConfirmedReservation): string {
  const start = new Date(confirmed.slot.slot_start);
  const end = new Date(confirmed.slot.slot_end);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const title = encodeURIComponent(confirmed.serviceName);
  const details = encodeURIComponent(
    confirmed.spotNumber !== null
      ? `${confirmed.spotLabel ?? 'Cupo'} ${confirmed.spotNumber}`
      : 'Reserva confirmada',
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}

function buildIcsContent(confirmed: ConfirmedReservation): string {
  const start = new Date(confirmed.slot.slot_start);
  const end = new Date(confirmed.slot.slot_end);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${confirmed.serviceName}`,
    confirmed.spotNumber !== null
      ? `DESCRIPTION:${confirmed.spotLabel ?? 'Cupo'} ${confirmed.spotNumber}`
      : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

function BookingModal({
  booking,
  onClose,
  onConfirm,
  memberProfile,
}: {
  booking: BookingState;
  onClose: () => void;
  onConfirm: (slot: Slot, spotNumber: number | null, name: string, rut: string) => Promise<ConfirmedReservation>;
  memberProfile: MemberProfile | null;
}) {
  const today = todayAsString();
  const stripDates = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));

  // date strip availability
  const [stripData, setStripData] = useState<Record<string, { available: number; capacity: number } | 'loading' | 'none'>>({});
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(booking.slot);
  const [spotsData, setSpotsData] = useState<SlotSpots | null>(null);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<number | null>(booking.spotNumber);
  const [step, setStep] = useState<BookingStep>(booking.step);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmed, setConfirmed] = useState<ConfirmedReservation | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const hasNamedSpots = !!booking.service.spotLabel;
  const STEPS: BookingStep[] = hasNamedSpots ? ['date', 'slot', 'spot'] : ['date', 'slot'];
  const stepIdx = STEPS.indexOf(step === 'success' ? (hasNamedSpots ? 'spot' : 'slot') : step);

  // Load strip availability
  useEffect(() => {
    if (step !== 'date') return;
    const initial: Record<string, 'loading' | 'none' | { available: number; capacity: number }> = {};
    stripDates.forEach(d => { initial[d] = 'loading'; });
    setStripData(initial);

    let cancelled = false;
    (async () => {
      await Promise.all(stripDates.map(async (d) => {
        try {
          const data = await apiFetch(`/public/availability?service_id=${booking.service.id}&date=${d}`);
          if (cancelled) return;
          const available = data.reduce((s: number, sl: Slot) => s + sl.available, 0);
          const capacity = data.reduce((s: number, sl: Slot) => s + sl.capacity, 0);
          setStripData(prev => ({
            ...prev,
            [d]: capacity > 0 ? { available, capacity } : 'none',
          }));
        } catch {
          if (!cancelled) setStripData(prev => ({ ...prev, [d]: 'none' }));
        }
      }));
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, booking.service.id]);

  // Scroll selected date into view
  useEffect(() => {
    if (step !== 'date' || !stripRef.current) return;
    const idx = stripDates.indexOf(date);
    if (idx < 0) return;
    const btn = stripRef.current.children[idx] as HTMLElement;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [date, step, stripDates]);

  const loadSlots = useCallback(async (d: string) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const data = await apiFetch(`/public/availability?service_id=${booking.service.id}&date=${d}`);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [booking.service.id]);

  const loadSpots = useCallback(async (slotStart: string) => {
    setLoadingSpots(true);
    try {
      const data: SlotSpots = await apiFetch(
        `/public/availability/spots?service_id=${booking.service.id}&slot_start=${encodeURIComponent(slotStart)}`,
      );
      setSpotsData(data);
    } catch {
      setSpotsData(null);
    } finally {
      setLoadingSpots(false);
    }
  }, [booking.service.id]);

  useEffect(() => {
    if (step === 'slot') loadSlots(date);
  }, [step, date, loadSlots]);

  useEffect(() => {
    if (step === 'spot' && selectedSlot) {
      setSelectedSpot(null);
      loadSpots(selectedSlot.slot_start);
    }
  }, [step, selectedSlot, loadSpots]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    if (hasNamedSpots && selectedSpot === null) return;
    setConfirming(true);
    setConfirmError('');
    try {
      const name = memberProfile ? `${memberProfile.first_name} ${memberProfile.last_name}` : '';
      const rut = memberProfile?.rut ?? '';
      const result = await onConfirm(selectedSlot, hasNamedSpots ? selectedSpot : null, name, rut);
      setConfirmed(result);
      setStep('success');
    } catch (e: any) {
      setConfirmError(e.message || 'Error al confirmar la reserva');
    } finally {
      setConfirming(false);
    }
  };

  const spotLabel = spotsData?.spot_label ?? booking.service.spotLabel;

  const stepLabel = step === 'date'
    ? 'Elige una fecha'
    : step === 'slot'
    ? formatSlotDate(`${date}T12:00:00`, booking.service.timezone)
    : step === 'spot'
    ? `Elige tu ${spotLabel ?? 'cupo'}`
    : '¡Reserva confirmada!';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">{booking.service.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{stepLabel}</p>
          </div>
          <button onClick={onClose} className="ml-3 flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step progress bar (only for non-success steps) */}
        {step !== 'success' && (
          <div className="flex px-5 pt-3 gap-1.5 flex-shrink-0">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-blue-500' : 'bg-gray-100'}`} />
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ── STEP: DATE ── */}
          {step === 'date' && (
            <div className="px-5 pt-4 pb-2">
              {/* Horizontal date strip */}
              <div
                ref={stripRef}
                className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
              >
                {stripDates.map((d) => {
                  const { weekday, day, month } = parseDateStr(d);
                  const info = stripData[d];
                  const isSelected = d === date;
                  const isLoading = info === 'loading';
                  const hasNone = info === 'none';
                  const available = typeof info === 'object' ? info.available : 0;
                  const capacity = typeof info === 'object' ? info.capacity : 0;
                  const dotColor = isLoading ? 'bg-gray-200 animate-pulse' : hasNone ? 'bg-gray-200' : available === 0 ? 'bg-red-400' : available / capacity <= 0.25 ? 'bg-orange-400' : 'bg-green-400';

                  return (
                    <button
                      key={d}
                      disabled={hasNone && !isLoading}
                      onClick={() => {
                        setDate(d);
                        setSelectedSlot(null);
                        setStep('slot');
                      }}
                      className={`flex-shrink-0 snap-start flex flex-col items-center gap-1 w-14 py-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : hasNone && !isLoading
                          ? 'border-transparent opacity-35 cursor-not-allowed'
                          : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/50'
                      }`}
                    >
                      <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>{weekday}</span>
                      <span className={`text-lg font-bold leading-none ${isSelected ? 'text-blue-600' : 'text-gray-800'}`}>{day}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>{month}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-400' : dotColor}`} />
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-3 pb-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Disponible</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Casi lleno</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Sin cupos</span>
              </div>
            </div>
          )}

          {/* ── STEP: SLOT ── */}
          {step === 'slot' && (
            <div className="px-5 pt-4 pb-4">
              {/* Loading skeleton */}
              {loadingSlots && (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 border border-gray-100 rounded-xl">
                      <Skeleton className="h-4 w-16 mb-1.5" />
                      <Skeleton className="h-3 w-10 mb-2" />
                      <Skeleton className="h-1 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingSlots && slots.length === 0 && (
                <div className="text-center py-10">
                  <Clock className="h-8 w-8 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">No hay horarios para esta fecha.</p>
                  <button
                    onClick={() => setStep('date')}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Elegir otra fecha
                  </button>
                </div>
              )}

              {!loadingSlots && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.slot_start === slot.slot_start;
                    const pct = slot.capacity > 0 ? slot.available / slot.capacity : 0;
                    const bgClass = !slot.bookable
                      ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                      : pct <= 0 ? 'bg-red-50 border-red-100 opacity-60 cursor-not-allowed'
                      : pct <= 0.25 ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                      : pct <= 0.5 ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30';

                    return (
                      <button
                        key={slot.slot_start}
                        disabled={!slot.bookable}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 border rounded-xl text-left transition-all ${bgClass}`}
                      >
                        <p className={`font-semibold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {formatSlotTime(slot.slot_start, booking.service.timezone)}
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className={`text-xs ${slot.available === 0 ? 'text-gray-400' : isSelected ? 'text-blue-500' : 'text-gray-500'}`}>
                            {slot.available > 0
                              ? `${slot.available} ${spotLabel ? `${spotLabel.toLowerCase()}s` : 'cupos'}`
                              : 'Sin cupos'}
                          </p>
                          <UrgencyBadge available={slot.available} capacity={slot.capacity} />
                        </div>
                        <CapacityBar available={slot.available} capacity={slot.capacity} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inline error */}
              {confirmError && step === 'slot' && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{confirmError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: SPOT ── */}
          {step === 'spot' && (
            <div className="px-5 pt-4 pb-4">
              {loadingSpots && (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              )}
              {!loadingSpots && spotsData && (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    {spotsData.spots.map((spot) => (
                      <button
                        key={spot.number}
                        disabled={!spot.available}
                        onClick={() => setSelectedSpot(spot.number)}
                        className={`aspect-square rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                          !spot.available
                            ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                            : selectedSpot === spot.number
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        {spotLabel && (
                          <span className="text-[9px] font-normal opacity-60 leading-none">{spotLabel}</span>
                        )}
                        <span>{spot.number}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-300" />Disponible</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" />Ocupado</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600" />Tu elección</span>
                  </div>
                </>
              )}
              {!loadingSpots && !spotsData && (
                <p className="text-center text-gray-400 py-6">Error al cargar los cupos.</p>
              )}

              {/* Inline error */}
              {confirmError && step === 'spot' && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{confirmError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === 'success' && confirmed && (
            <div className="px-6 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-9 w-9 text-green-500" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">¡Reserva confirmada!</h3>
              <p className="text-sm text-gray-500 mb-5">
                Te esperamos el{' '}
                <span className="font-medium text-gray-700">
                  {formatSlotDate(`${confirmed.date}T12:00:00`, confirmed.timezone)}
                </span>{' '}
                a las{' '}
                <span className="font-medium text-gray-700">
                  {formatSlotTime(confirmed.slot.slot_start, confirmed.timezone)}
                </span>
                {confirmed.spotNumber !== null && (
                  <>
                    {' '}·{' '}
                    <span className="font-medium text-gray-700">
                      {confirmed.spotLabel ?? 'Cupo'} {confirmed.spotNumber}
                    </span>
                  </>
                )}
              </p>

              {/* Add to calendar */}
              <div className="flex flex-col gap-2 mb-6">
                <a
                  href={buildGoogleCalendarUrl(confirmed)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Agregar a Google Calendar
                </a>
                <button
                  onClick={() => {
                    const ics = buildIcsContent(confirmed);
                    const blob = new Blob([ics], { type: 'text/calendar' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'reserva.ics';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Descargar archivo .ics
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="/portal/mis-reservas"
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors text-center"
                >
                  Ver mis reservas
                </a>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        {step !== 'date' && step !== 'success' && (
          <div className="px-5 py-4 border-t bg-white rounded-b-2xl flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => {
                setConfirmError('');
                if (step === 'slot') setStep('date');
                else if (step === 'spot') setStep('slot');
              }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>
            <button
              disabled={
                (step === 'slot' && (!selectedSlot || confirming)) ||
                (step === 'spot' && (selectedSpot === null || confirming))
              }
              onClick={() => {
                if (step === 'slot' && selectedSlot) {
                  if (hasNamedSpots) setStep('spot');
                  else handleConfirm();
                } else if (step === 'spot') {
                  handleConfirm();
                }
              }}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {(step === 'spot' || (step === 'slot' && !hasNamedSpots))
                ? (confirming ? 'Reservando...' : 'Confirmar reserva')
                : 'Siguiente'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CenterPage() {
  const { centerCode } = useParams<{ centerCode: string }>();
  const router = useRouter();

  const [center, setCenter] = useState<Center | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingState | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);

  useEffect(() => {
    setMemberProfile(getMemberProfile());
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const centers: Center[] = await apiFetch(`/public/centers?q=${encodeURIComponent(centerCode)}`);
        const exact = centers.find((c) => c.center_code === centerCode);
        if (!exact) { setCenter(null); setLoading(false); return; }
        setCenter(exact);
        const svcs: Service[] = await apiFetch(`/public/centers/${centerCode}/services`);
        setServices(svcs);
      } catch {
        setCenter(null);
      } finally {
        setLoading(false);
      }
    }
    if (centerCode) load();
  }, [centerCode]);

  const handleBook = (service: Service) => {
    const token = getMemberToken();
    if (!token) {
      router.push(`/portal/login?redirect=/portal/${centerCode}`);
      return;
    }
    setBooking({ service, date: todayAsString(), slot: null, spotNumber: null, step: 'date' });
  };

  const handleConfirm = async (
    slot: Slot,
    spotNumber: number | null,
    customerName: string,
    customerRut: string,
  ): Promise<ConfirmedReservation> => {
    const token = getMemberToken();
    if (!token || !booking) throw new Error('No autenticado');

    const body: Record<string, any> = {
      service_id: booking.service.id,
      slot_start: slot.slot_start,
      customer_name: customerName,
      customer_external_id: customerRut || undefined,
    };
    if (spotNumber !== null) body.spot_number = spotNumber;

    const res = await fetch(`${BASE}/members/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al reservar';
      throw new Error(msg);
    }

    return {
      date: booking.date,
      slot,
      spotNumber,
      spotLabel: booking.service.spotLabel,
      timezone: booking.service.timezone,
      serviceName: booking.service.name,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Centro no encontrado</h1>
        <p className="text-gray-500 mb-6">El código &ldquo;{centerCode}&rdquo; no corresponde a ningún centro.</p>
        <a href="/portal" className="text-blue-600 hover:underline">Volver al buscador</a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Center header */}
      <div className="mb-8">
        <a href="/portal" className="text-sm text-gray-400 hover:text-blue-600 mb-3 inline-block">
          ← Volver al buscador
        </a>
        <h1 className="text-3xl font-bold text-gray-900">{center.center_name || center.center_code}</h1>
        {center.center_code && <p className="text-sm text-gray-400 mt-1">/{center.center_code}</p>}
      </div>

      {/* Services */}
      {services.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Este centro no tiene eventos disponibles actualmente.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Eventos disponibles</h2>
          <div className="grid gap-4">
            {services.map((service) => (
              <div key={service.id} className="border border-gray-100 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    {service.description && <p className="text-sm text-gray-500 mt-1">{service.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.slotDurationMinutes} min
                      </span>
                      <span>
                        {service.maxSpots}{' '}
                        {service.spotLabel ? `${service.spotLabel.toLowerCase()}s` : 'cupos'}{' '}
                        por clase
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBook(service)}
                    className="flex-shrink-0 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reservar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Booking modal */}
      {booking && (
        <BookingModal
          booking={booking}
          memberProfile={memberProfile}
          onClose={() => setBooking(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

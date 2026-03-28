'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, X, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { getMemberToken, getMemberProfile, type MemberProfile } from '@/lib/member-auth';
import { formatSlotDate, formatSlotTime, todayAsString } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAY_SHORT = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function dotColor(available: number, capacity: number) {
  if (available === 0) return 'bg-red-400';
  return available / capacity <= 0.25 ? 'bg-orange-400' : 'bg-green-400';
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

interface Center { id: string; center_name: string | null; center_code: string | null; }
interface Service {
  id: string; name: string; description: string | null; timezone: string;
  slotDurationMinutes: number; maxSpots: number; spotLabel: string | null; isActive: boolean;
}
interface Slot {
  slot_start: string; slot_end: string; capacity: number;
  reserved: number; available: number; bookable: boolean;
}
interface SpotInfo { number: number; available: boolean; }
interface SlotSpots {
  service_id: string; slot_start: string; slot_end: string;
  max_spots: number; spot_label: string | null; spots: SpotInfo[];
}
interface UpcomingSlot { date: string; slot: Slot; }
interface ConfirmedReservation {
  date: string; slot: Slot; spotNumber: number | null;
  spotLabel: string | null; timezone: string; serviceName: string;
}
type BookingStep = 'date' | 'slot' | 'spot' | 'success';
interface BookingState {
  service: Service; date: string; slot: Slot | null; spotNumber: number | null; step: BookingStep;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers }, ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json.data ?? json;
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
  if (available === 1)
    return <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">Último cupo</span>;
  if (available / capacity <= 0.25)
    return <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">Casi lleno</span>;
  return null;
}

function buildGoogleCalendarUrl(c: ConfirmedReservation): string {
  const s = new Date(c.slot.slot_start), e = new Date(c.slot.slot_end);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(c.serviceName)}&dates=${fmt(s)}/${fmt(e)}&details=${encodeURIComponent(c.spotNumber != null ? `${c.spotLabel ?? 'Cupo'} ${c.spotNumber}` : 'Reserva confirmada')}`;
}

function buildIcsContent(c: ConfirmedReservation): string {
  const s = new Date(c.slot.slot_start), e = new Date(c.slot.slot_end);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  return ['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`DTSTART:${fmt(s)}`,`DTEND:${fmt(e)}`,`SUMMARY:${c.serviceName}`,c.spotNumber != null ? `DESCRIPTION:${c.spotLabel ?? 'Cupo'} ${c.spotNumber}` : '','END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
}

// ─── Booking Modal ────────────────────────────────────────────────────────────
function BookingModal({ booking, onClose, onConfirm, memberProfile }: {
  booking: BookingState;
  onClose: () => void;
  onConfirm: (slot: Slot, spotNumber: number | null, name: string, rut: string) => Promise<ConfirmedReservation>;
  memberProfile: MemberProfile | null;
}) {
  const today = todayAsString();
  const todayDate = new Date(today + 'T12:00:00');
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [monthData, setMonthData] = useState<Record<string, { available: number; capacity: number }> | null>(null);
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
  // Set of slot_start UTC strings the member already booked (active reservations)
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());

  const hasNamedSpots = !!booking.service.spotLabel;

  // Load member's existing active reservations for this service on mount
  useEffect(() => {
    const token = getMemberToken();
    if (!token) return;
    fetch(`${BASE}/members/reservations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const list: Array<{ serviceId: string; slotStart: string; status: string }> = json.data ?? json;
        const booked = new Set(
          list
            .filter(r => r.serviceId === booking.service.id && (r.status === 'confirmed' || r.status === 'pending'))
            .map(r => r.slotStart),
        );
        setBookedSlots(booked);
      })
      .catch(() => { /* non-critical */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.service.id]);
  const STEPS: BookingStep[] = hasNamedSpots ? ['date', 'slot', 'spot'] : ['date', 'slot'];
  const stepIdx = STEPS.indexOf(step === 'success' ? (hasNamedSpots ? 'spot' : 'slot') : step);
  const spotLabel = spotsData?.spot_label ?? booking.service.spotLabel;

  const allDays = Array.from({ length: daysInMonth(year, month) }, (_, i) => toDateStr(year, month, i + 1));

  // Load month availability
  useEffect(() => {
    if (step !== 'date') return;
    setMonthData(null);
    let cancelled = false;
    (async () => {
      const results: Record<string, { available: number; capacity: number }> = {};
      await Promise.all(allDays.map(async (d) => {
        if (d < today) return;
        try {
          const raw = await apiFetch(`/public/availability?service_id=${booking.service.id}&date=${d}`);
          const data = (raw as Slot[]).filter(sl => sl.bookable);
          const available = data.reduce((s: number, sl: Slot) => s + sl.available, 0);
          const capacity  = data.reduce((s: number, sl: Slot) => s + sl.capacity,  0);
          if (capacity > 0) results[d] = { available, capacity };
        } catch { /* no slots */ }
      }));
      if (!cancelled) setMonthData(results);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, year, month, booking.service.id]);

  const loadSlots = useCallback(async (d: string) => {
    setLoadingSlots(true); setSlots([]);
    try {
      const all: Slot[] = await apiFetch(`/public/availability?service_id=${booking.service.id}&date=${d}`);
      setSlots(all.filter(s => s.bookable));
    }
    catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, [booking.service.id]);

  const loadSpots = useCallback(async (slotStart: string) => {
    setLoadingSpots(true);
    try { setSpotsData(await apiFetch(`/public/availability/spots?service_id=${booking.service.id}&slot_start=${encodeURIComponent(slotStart)}`)); }
    catch { setSpotsData(null); }
    finally { setLoadingSpots(false); }
  }, [booking.service.id]);

  useEffect(() => { if (step === 'slot') loadSlots(date); }, [step, date, loadSlots]);
  useEffect(() => {
    if (step === 'spot' && selectedSlot) { setSelectedSpot(null); loadSpots(selectedSlot.slot_start); }
  }, [step, selectedSlot, loadSpots]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    if (hasNamedSpots && selectedSpot === null) return;
    setConfirming(true); setConfirmError('');
    try {
      const name = memberProfile ? `${memberProfile.first_name} ${memberProfile.last_name}` : '';
      const result = await onConfirm(selectedSlot, hasNamedSpots ? selectedSpot : null, name, '');
      setConfirmed(result); setStep('success');
    } catch (e: any) {
      if (e.message === 'DUPLICATE_BOOKING') {
        setConfirmError('DUPLICATE_BOOKING');
      } else {
        setConfirmError(e.message || 'Error al confirmar la reserva');
      }
    } finally { setConfirming(false); }
  };

  const stepLabel = step === 'date' ? 'Selecciona una fecha'
    : step === 'slot' ? formatSlotDate(`${date}T12:00:00`, booking.service.timezone)
    : step === 'spot' ? `Elige tu ${spotLabel ?? 'cupo'}`
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

        {/* Progress bar */}
        {step !== 'success' && (
          <div className="flex px-5 pt-3 gap-1.5 flex-shrink-0">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-blue-500' : 'bg-gray-100'}`} />
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ── STEP: DATE (monthly calendar) ── */}
          {step === 'date' && (
            <div className="px-5 pt-4 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</span>
                <button onClick={() => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-7">
                {WEEKDAY_SHORT.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDow(year, month) }, (_, i) => <div key={`e${i}`} />)}
                {allDays.map((dateStr) => {
                  const dayNum = parseInt(dateStr.split('-')[2], 10);
                  const isPast = dateStr < today;
                  const isSelected = dateStr === date;
                  const info = monthData?.[dateStr];
                  const noSlots = !!monthData && !info;
                  const disabled = isPast || noSlots;
                  return (
                    <button key={dateStr} disabled={disabled}
                      onClick={() => { setDate(dateStr); setStep('slot'); }}
                      className={`flex flex-col items-center py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                        ${isSelected ? 'bg-blue-600 text-white' : !disabled ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-700'}`}
                    >
                      <span className="text-sm leading-none">{dayNum}</span>
                      {info && !isPast ? (
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor(info.available, info.capacity)}`} />
                      ) : <span className="mt-1 w-1.5 h-1.5" />}
                    </button>
                  );
                })}
              </div>
              {monthData && (
                <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 border-t">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Disponible</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Casi lleno</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Sin cupos</span>
                </div>
              )}
              {!monthData && <p className="text-center text-xs text-gray-400 pt-2">Cargando disponibilidad...</p>}
            </div>
          )}

          {/* ── STEP: SLOT ── */}
          {step === 'slot' && (
            <div className="px-5 pt-4 pb-4">
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
                  <button onClick={() => setStep('date')} className="mt-3 text-sm text-blue-600 hover:underline">Elegir otra fecha</button>
                </div>
              )}
              {!loadingSlots && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.slot_start === slot.slot_start;
                    const alreadyBooked = bookedSlots.has(slot.slot_start);
                    const pct = slot.capacity > 0 ? slot.available / slot.capacity : 0;

                    if (alreadyBooked) {
                      return (
                        <a key={slot.slot_start} href="/portal/mis-reservas"
                          className="p-3 border-2 border-blue-200 bg-blue-50 rounded-xl text-left block">
                          <p className="font-semibold text-sm text-blue-700">
                            {formatSlotTime(slot.slot_start, booking.service.timezone)}
                          </p>
                          <p className="text-xs text-blue-500 mt-0.5 font-medium">✓ Ya reservaste</p>
                          <p className="text-[11px] text-blue-400 mt-0.5 underline">Manejar mis reservas →</p>
                        </a>
                      );
                    }

                    const bgClass = !slot.bookable ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                      : isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                      : pct <= 0 ? 'bg-red-50 border-red-100 opacity-60 cursor-not-allowed'
                      : pct <= 0.25 ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                      : pct <= 0.5 ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30';
                    return (
                      <button key={slot.slot_start} disabled={!slot.bookable} onClick={() => setSelectedSlot(slot)}
                        className={`p-3 border rounded-xl text-left transition-all ${bgClass}`}>
                        <p className={`font-semibold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {formatSlotTime(slot.slot_start, booking.service.timezone)}
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className={`text-xs ${slot.available === 0 ? 'text-gray-400' : isSelected ? 'text-blue-500' : 'text-gray-500'}`}>
                            {slot.available > 0 ? `${slot.available} ${spotLabel ? `${spotLabel.toLowerCase()}s` : 'cupos'}` : 'Sin cupos'}
                          </p>
                          <UrgencyBadge available={slot.available} capacity={slot.capacity} />
                        </div>
                        <CapacityBar available={slot.available} capacity={slot.capacity} />
                      </button>
                    );
                  })}
                </div>
              )}
              {confirmError === 'DUPLICATE_BOOKING' ? (
                <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Ya tienes una reserva para este horario.{' '}
                    <a href="/portal/mis-reservas" className="underline font-medium">Manejar mis reservas →</a>
                  </span>
                </div>
              ) : confirmError ? (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{confirmError}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* ── STEP: SPOT ── */}
          {step === 'spot' && (
            <div className="px-5 pt-4 pb-4">
              {loadingSpots && (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                </div>
              )}
              {!loadingSpots && spotsData && (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    {spotsData.spots.map((spot) => (
                      <button key={spot.number} disabled={!spot.available} onClick={() => setSelectedSpot(spot.number)}
                        className={`aspect-square rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                          !spot.available ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                          : selectedSpot === spot.number ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'}`}>
                        {spotLabel && <span className="text-[9px] font-normal opacity-60 leading-none">{spotLabel}</span>}
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
              {!loadingSpots && !spotsData && <p className="text-center text-gray-400 py-6">Error al cargar los cupos.</p>}
              {confirmError && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{confirmError}</span>
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
                <span className="font-medium text-gray-700">{formatSlotDate(`${confirmed.date}T12:00:00`, confirmed.timezone)}</span>
                {' '}a las{' '}
                <span className="font-medium text-gray-700">{formatSlotTime(confirmed.slot.slot_start, confirmed.timezone)}</span>
                {confirmed.spotNumber !== null && <>{' '}·{' '}<span className="font-medium text-gray-700">{confirmed.spotLabel ?? 'Cupo'} {confirmed.spotNumber}</span></>}
              </p>
              <div className="flex flex-col gap-2 mb-6">
                <a href={buildGoogleCalendarUrl(confirmed)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Calendar className="h-4 w-4 text-blue-500" />Agregar a Google Calendar
                </a>
                <button onClick={() => {
                    const blob = new Blob([buildIcsContent(confirmed)], { type: 'text/calendar' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a');
                    a.href = url; a.download = 'reserva.ics'; a.click(); URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Calendar className="h-4 w-4 text-gray-400" />Descargar archivo .ics
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <a href="/portal/mis-reservas"
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors text-center">
                  Ver mis reservas
                </a>
                <button onClick={onClose}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {step !== 'date' && step !== 'success' && (
          <div className="px-5 py-4 border-t bg-white rounded-b-2xl flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setConfirmError(''); if (step === 'slot') setStep('date'); else if (step === 'spot') setStep('slot'); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="h-4 w-4" />Atrás
            </button>
            <button
              disabled={(step === 'slot' && (!selectedSlot || confirming)) || (step === 'spot' && (selectedSpot === null || confirming))}
              onClick={() => {
                if (step === 'slot' && selectedSlot) { if (hasNamedSpots) setStep('spot'); else handleConfirm(); }
                else if (step === 'spot') handleConfirm();
              }}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {(step === 'spot' || (step === 'slot' && !hasNamedSpots)) ? (confirming ? 'Reservando...' : 'Confirmar reserva') : 'Siguiente'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Service Card with upcoming slots ─────────────────────────────────────────
function ServiceCard({ service, onBook, onQuickBook }: {
  service: Service;
  onBook: (service: Service) => void;
  onQuickBook: (service: Service, date: string, slot: Slot) => void;
}) {
  const today = todayAsString();
  const [upcoming, setUpcoming] = useState<UpcomingSlot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: UpcomingSlot[] = [];
      for (let i = 0; i < 14 && found.length < 4; i++) {
        const d = addDays(today, i);
        try {
          const slots: Slot[] = await apiFetch(`/public/availability?service_id=${service.id}&date=${d}`);
          const bookable = slots.filter(s => s.bookable && s.available > 0);
          for (const slot of bookable) {
            if (found.length >= 4) break;
            found.push({ date: d, slot });
          }
        } catch { /* skip */ }
        if (cancelled) return;
      }
      if (!cancelled) setUpcoming(found);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  function chipLabel(date: string, slot: Slot): string {
    const d = new Date(date + 'T12:00:00');
    const t = today;
    const tom = addDays(t, 1);
    const prefix = date === t ? 'Hoy' : date === tom ? 'Mañana' : d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
    return `${prefix} ${formatSlotTime(slot.slot_start, service.timezone)}`;
  }

  function chipColor(slot: Slot) {
    const pct = slot.capacity > 0 ? slot.available / slot.capacity : 0;
    if (slot.available === 1) return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100';
    if (pct <= 0.25) return 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100';
    return 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100';
  }

  return (
    <div className="border border-gray-100 rounded-2xl p-5 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-base">{service.name}</h3>
          {service.description && <p className="text-sm text-gray-500 mt-1">{service.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{service.slotDurationMinutes} min</span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {service.maxSpots} {service.spotLabel ? `${service.spotLabel.toLowerCase()}s` : 'cupos'}
            </span>
          </div>
        </div>
        <button onClick={() => onBook(service)}
          className="flex-shrink-0 text-sm text-blue-600 font-medium hover:underline">
          Ver calendario
        </button>
      </div>

      {/* Upcoming slots chips */}
      {upcoming === null && (
        <div className="flex gap-2 overflow-hidden">
          {['w-20', 'w-16', 'w-18', 'w-16'].map((w, i) => <Skeleton key={i} className={`h-7 rounded-full flex-shrink-0 ${w}`} />)}
        </div>
      )}
      {upcoming !== null && upcoming.length === 0 && (
        <p className="text-xs text-gray-400">No hay clases disponibles próximamente.</p>
      )}
      {upcoming !== null && upcoming.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Próximas clases disponibles:</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(({ date, slot }) => (
              <button key={slot.slot_start} onClick={() => onQuickBook(service, date, slot)}
                className={`text-xs font-medium border rounded-full px-3 py-1.5 transition-colors flex-shrink-0 ${chipColor(slot)}`}>
                {chipLabel(date, slot)}
                {slot.available === 1 && <span className="ml-1 opacity-70">· último</span>}
              </button>
            ))}
            <button onClick={() => onBook(service)}
              className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1.5 transition-colors">
              Más fechas →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CenterPage() {
  const { centerCode } = useParams<{ centerCode: string }>();
  const router = useRouter();
  const [center, setCenter] = useState<Center | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingState | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);

  useEffect(() => { setMemberProfile(getMemberProfile()); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const centers: Center[] = await apiFetch(`/public/centers?q=${encodeURIComponent(centerCode)}`);
        const exact = centers.find((c) => c.center_code === centerCode);
        if (!exact) { setCenter(null); setLoading(false); return; }
        setCenter(exact);
        setServices(await apiFetch(`/public/centers/${centerCode}/services`));
      } catch { setCenter(null); }
      finally { setLoading(false); }
    }
    if (centerCode) load();
  }, [centerCode]);

  const handleBook = (service: Service) => {
    if (!getMemberToken()) { router.push(`/portal/login?redirect=/portal/${centerCode}`); return; }
    setBooking({ service, date: todayAsString(), slot: null, spotNumber: null, step: 'date' });
  };

  // Quick-book: jump straight to slot step for a specific date
  const handleQuickBook = (service: Service, date: string, slot: Slot) => {
    if (!getMemberToken()) { router.push(`/portal/login?redirect=/portal/${centerCode}`); return; }
    setBooking({ service, date, slot, spotNumber: null, step: 'slot' });
  };

  const handleConfirm = async (slot: Slot, spotNumber: number | null, customerName: string, customerRut: string): Promise<ConfirmedReservation> => {
    const token = getMemberToken();
    if (!token || !booking) throw new Error('No autenticado');
    const body: Record<string, any> = {
      service_id: booking.service.id, slot_start: slot.slot_start,
      customer_name: customerName, customer_external_id: customerRut || undefined,
    };
    if (spotNumber !== null) body.spot_number = spotNumber;
    const res = await fetch(`${BASE}/members/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al reservar');
    return { date: booking.date, slot, spotNumber, spotLabel: booking.service.spotLabel, timezone: booking.service.timezone, serviceName: booking.service.name };
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="text-gray-400">Cargando...</div></div>;

  if (!center) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Centro no encontrado</h1>
      <p className="text-gray-500 mb-6">El código &ldquo;{centerCode}&rdquo; no corresponde a ningún centro.</p>
      <a href="/portal" className="text-blue-600 hover:underline">Volver al buscador</a>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <a href="/portal" className="text-sm text-gray-400 hover:text-blue-600 mb-3 inline-block">← Volver al buscador</a>
        <h1 className="text-3xl font-bold text-gray-900">{center.center_name || center.center_code}</h1>
        {center.center_code && <p className="text-sm text-gray-400 mt-1">/{center.center_code}</p>}
      </div>

      {services.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Este centro no tiene eventos disponibles actualmente.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Clases disponibles</h2>
          <div className="grid gap-4">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} onBook={handleBook} onQuickBook={handleQuickBook} />
            ))}
          </div>
        </>
      )}

      {booking && (
        <BookingModal booking={booking} memberProfile={memberProfile}
          onClose={() => setBooking(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}

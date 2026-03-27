'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

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
import { getMemberToken, getMemberProfile, type MemberProfile } from '@/lib/member-auth';
import { formatSlotDate, formatSlotTime, todayAsString } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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

type BookingStep = 'date' | 'slot' | 'spot';

interface BookingState {
  service: Service;
  date: string;
  slot: Slot | null;
  spotNumber: number | null;
  step: BookingStep;
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

function getAvailabilityColor(available: number, capacity: number) {
  if (available === 0) return 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed opacity-60';
  const pct = available / capacity;
  if (pct <= 0.25) return 'bg-orange-50 text-orange-700 border-orange-100 hover:border-orange-300';
  if (pct <= 0.5) return 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:border-yellow-300';
  return 'bg-green-50 text-green-700 border-green-100 hover:border-green-300';
}

function BookingModal({
  booking,
  onClose,
  onConfirm,
  memberProfile,
}: {
  booking: BookingState;
  onClose: () => void;
  onConfirm: (slot: Slot, spotNumber: number | null, name: string, rut: string) => Promise<void>;
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

  const loadSlots = useCallback(async (d: string) => {
    setLoadingSlots(true);
    try {
      const data = await apiFetch(
        `/public/availability?service_id=${booking.service.id}&date=${d}`,
      );
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

  const allDays = useMemo(
    () => Array.from({ length: daysInMonth(year, month) }, (_, i) => toDateStr(year, month, i + 1)),
    [year, month],
  );

  useEffect(() => {
    if (step !== 'date') return;
    setMonthData(null);
    let cancelled = false;
    (async () => {
      const results: Record<string, { available: number; capacity: number }> = {};
      await Promise.all(allDays.map(async (d) => {
        if (d < today) return;
        try {
          const slotsData = await apiFetch(`/public/availability?service_id=${booking.service.id}&date=${d}`);
          const available = slotsData.reduce((s: number, sl: Slot) => s + sl.available, 0);
          const capacity  = slotsData.reduce((s: number, sl: Slot) => s + sl.capacity,  0);
          if (capacity > 0) results[d] = { available, capacity };
        } catch { /* no slots */ }
      }));
      if (!cancelled) setMonthData(results);
    })();
    return () => { cancelled = true; };
  }, [step, year, month, allDays, booking.service.id, today]);

  const hasNamedSpots = !!booking.service.spotLabel;

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
      const name = memberProfile
        ? `${memberProfile.first_name} ${memberProfile.last_name}`
        : '';
      const rut = memberProfile?.rut ?? '';
      await onConfirm(selectedSlot, hasNamedSpots ? selectedSpot : null, name, rut);
    } catch (e: any) {
      setConfirmError(e.message || 'Error al confirmar la reserva');
    } finally {
      setConfirming(false);
    }
  };

  const STEPS: BookingStep[] = hasNamedSpots ? ['date', 'slot', 'spot'] : ['date', 'slot'];
  const stepIdx = STEPS.indexOf(step);

  const spotLabel = spotsData?.spot_label ?? booking.service.spotLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{booking.service.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'date' && 'Selecciona una fecha'}
              {step === 'slot' && 'Selecciona un horario'}
              {step === 'spot' && `Elige tu ${spotLabel ?? 'cupo'}`}
            </p>

          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-3 gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${i <= stepIdx ? 'bg-blue-500' : 'bg-gray-100'}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Date — calendar */}
          {step === 'date' && (
            <div className="space-y-3">
              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</span>
                <button
                  onClick={() => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              {/* Weekday headers */}
              <div className="grid grid-cols-7">
                {WEEKDAY_SHORT.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {/* Day cells */}
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
                    <button
                      key={dateStr}
                      disabled={disabled}
                      onClick={() => { setDate(dateStr); setStep('slot'); }}
                      className={`flex flex-col items-center py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                        ${isSelected ? 'bg-blue-600 text-white' : !disabled ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-700'}
                      `}
                    >
                      <span className="text-sm leading-none">{dayNum}</span>
                      {info && !isPast ? (
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor(info.available, info.capacity)}`} />
                      ) : (
                        <span className="mt-1 w-1.5 h-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
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

          {/* Step 2: Slot */}
          {step === 'slot' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {formatSlotDate(`${date}T12:00:00`, booking.service.timezone)}
              </p>
              {loadingSlots && <p className="text-center text-gray-400 py-6">Cargando horarios...</p>}
              {!loadingSlots && slots.length === 0 && (
                <p className="text-center text-gray-400 py-6">No hay horarios disponibles para esta fecha.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.slot_start}
                    disabled={!slot.bookable}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-3 border rounded-lg text-left transition-all ${
                      selectedSlot?.slot_start === slot.slot_start
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : getAvailabilityColor(slot.available, slot.capacity)
                    }`}
                  >
                    <p className="font-medium text-sm">
                      {formatSlotTime(slot.slot_start, booking.service.timezone)}
                    </p>
                    <p className="text-xs mt-0.5">
                      {slot.available > 0
                        ? `${slot.available} ${spotLabel ? `${spotLabel.toLowerCase()}s` : 'cupos'} libres`
                        : 'Sin cupos'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Spot selection */}
          {step === 'spot' && (
            <div>
              <p className="text-sm text-gray-500 mb-1">
                {formatSlotDate(`${date}T12:00:00`, booking.service.timezone)}
                {selectedSlot && ` · ${formatSlotTime(selectedSlot.slot_start, booking.service.timezone)}`}
              </p>
              <p className="text-sm font-medium text-gray-700 mb-4">
                Elige {spotLabel ? `tu ${spotLabel.toLowerCase()}` : 'un cupo'}
              </p>
              {loadingSpots && <p className="text-center text-gray-400 py-6">Cargando cupos...</p>}
              {!loadingSpots && spotsData && (
                <div className="grid grid-cols-5 gap-2">
                  {spotsData.spots.map((spot) => (
                    <button
                      key={spot.number}
                      disabled={!spot.available}
                      onClick={() => setSelectedSpot(spot.number)}
                      className={`aspect-square rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                        !spot.available
                          ? 'bg-red-50 border-red-200 text-red-300 cursor-not-allowed'
                          : selectedSpot === spot.number
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                          : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-400'
                      }`}
                    >
                      {spotLabel && (
                        <span className="text-[9px] font-normal opacity-70 leading-none">
                          {spotLabel}
                        </span>
                      )}
                      <span>{spot.number}</span>
                    </button>
                  ))}
                </div>
              )}
              {!loadingSpots && !spotsData && (
                <p className="text-center text-gray-400 py-6">Error al cargar los cupos.</p>
              )}
              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                  Disponible
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
                  Ocupado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600" />
                  Tu elección
                </span>
              </div>
            </div>
          )}

          {/* Error al confirmar */}
          {step === 'spot' && confirmError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {confirmError}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'date' && (
          <div className="p-5 border-t flex justify-between">
            <button
              onClick={() => {
                if (step === 'slot') setStep('date');
                else if (step === 'spot') { setConfirmError(''); setStep('slot'); }
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
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
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
  const [successMessage, setSuccessMessage] = useState('');
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);

  useEffect(() => {
    setMemberProfile(getMemberProfile());
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const centers: Center[] = await apiFetch(
          `/public/centers?q=${encodeURIComponent(centerCode)}`,
        );
        const exact = centers.find((c) => c.center_code === centerCode);
        if (!exact) {
          setCenter(null);
          setLoading(false);
          return;
        }
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
    setSuccessMessage('');
    setBooking({ service, date: todayAsString(), slot: null, spotNumber: null, step: 'date' });
  };

  const handleConfirm = async (
    slot: Slot,
    spotNumber: number | null,
    customerName: string,
    customerRut: string,
  ) => {
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al reservar';
      throw new Error(msg);
    }

    const spotLabel = booking.service.spotLabel;
    const spotStr = spotNumber !== null
      ? (spotLabel ? `${spotLabel} ${spotNumber}` : `cupo #${spotNumber}`)
      : '';
    setBooking(null);
    setSuccessMessage(
      `Reserva confirmada${spotStr ? `: ${spotStr}` : ''} el ${formatSlotDate(`${booking.date}T12:00:00`, booking.service.timezone)} a las ${formatSlotTime(slot.slot_start, booking.service.timezone)}`,
    );
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
        <h1 className="text-3xl font-bold text-gray-900">
          {center.center_name || center.center_code}
        </h1>
        {center.center_code && (
          <p className="text-sm text-gray-400 mt-1">/{center.center_code}</p>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-4">
          {successMessage}{' '}
          <a href="/portal/mis-reservas" className="underline font-medium">Ver mis reservas</a>
        </div>
      )}

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
              <div
                key={service.id}
                className="border border-gray-100 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.slotDurationMinutes} min
                      </span>
                      <span>
                        {service.maxSpots}{' '}
                        {service.spotLabel
                          ? `${service.spotLabel.toLowerCase()}s`
                          : 'cupos'}{' '}
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

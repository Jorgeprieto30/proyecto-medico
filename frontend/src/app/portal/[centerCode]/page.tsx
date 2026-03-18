'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
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

type BookingStep = 'date' | 'slot' | 'confirm';

interface BookingState {
  service: Service;
  date: string;
  slot: Slot | null;
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
  onConfirm: (slot: Slot, name: string, rut: string) => Promise<void>;
  memberProfile: MemberProfile | null;
}) {
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(booking.slot);
  const [step, setStep] = useState<BookingStep>(booking.step);
  const [customerName, setCustomerName] = useState(
    memberProfile ? `${memberProfile.first_name} ${memberProfile.last_name}` : '',
  );
  const [customerRut, setCustomerRut] = useState(memberProfile?.rut ?? '');
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

  useEffect(() => {
    if (step === 'slot') loadSlots(date);
  }, [step, date, loadSlots]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setConfirming(true);
    setConfirmError('');
    try {
      await onConfirm(selectedSlot, customerName, customerRut);
    } catch (e: any) {
      setConfirmError(e.message || 'Error al confirmar la reserva');
    } finally {
      setConfirming(false);
    }
  };

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
              {step === 'confirm' && 'Confirma tu reserva'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-3 gap-2">
          {(['date', 'slot', 'confirm'] as BookingStep[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${step === s || (i < ['date', 'slot', 'confirm'].indexOf(step)) ? 'bg-blue-500' : 'bg-gray-100'}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Date */}
          {step === 'date' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setDate(addDays(date, -1))}
                  disabled={date <= todayAsString()}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <input
                  type="date"
                  value={date}
                  min={todayAsString()}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setDate(addDays(date, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 text-center">
                {formatSlotDate(`${date}T12:00:00`, booking.service.timezone)}
              </p>
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
                      {slot.available > 0 ? `${slot.available} cupo${slot.available > 1 ? 's' : ''}` : 'Sin cupos'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedSlot && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900">{booking.service.name}</p>
                <p className="text-sm text-blue-700 mt-1">
                  {formatSlotDate(`${date}T12:00:00`, booking.service.timezone)}
                </p>
                <p className="text-sm text-blue-700">
                  {formatSlotTime(selectedSlot.slot_start, booking.service.timezone)} -{' '}
                  {formatSlotTime(selectedSlot.slot_end, booking.service.timezone)}
                </p>
              </div>

              {confirmError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {confirmError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={customerRut}
                  onChange={(e) => setCustomerRut(e.target.value)}
                  placeholder="12.345.678-9"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex justify-between">
          <button
            onClick={() => {
              if (step === 'date') onClose();
              else if (step === 'slot') setStep('date');
              else if (step === 'confirm') setStep('slot');
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {step === 'date' ? 'Cancelar' : 'Atrás'}
          </button>
          <button
            disabled={
              (step === 'slot' && !selectedSlot) ||
              (step === 'confirm' && (!customerName.trim() || confirming))
            }
            onClick={() => {
              if (step === 'date') setStep('slot');
              else if (step === 'slot' && selectedSlot) setStep('confirm');
              else if (step === 'confirm') handleConfirm();
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 'confirm' ? (confirming ? 'Confirmando...' : 'Confirmar reserva') : 'Siguiente'}
          </button>
        </div>
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
    setBooking({ service, date: todayAsString(), slot: null, step: 'date' });
  };

  const handleConfirm = async (slot: Slot, customerName: string, customerRut: string) => {
    const token = getMemberToken();
    if (!token || !booking) throw new Error('No autenticado');

    const res = await fetch(`${BASE}/members/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        service_id: booking.service.id,
        slot_start: slot.slot_start,
        customer_name: customerName,
        customer_external_id: customerRut || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al reservar';
      throw new Error(msg);
    }
    setBooking(null);
    setSuccessMessage(`Reserva confirmada para ${formatSlotDate(`${booking.date}T12:00:00`, booking.service.timezone)} a las ${formatSlotTime(slot.slot_start, booking.service.timezone)}`);
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
                      <span>{service.timezone}</span>
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

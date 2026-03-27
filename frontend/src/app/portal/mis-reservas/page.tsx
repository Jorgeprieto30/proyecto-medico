'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMemberToken } from '@/lib/member-auth';
import { formatSlotDate, formatSlotTime, getStatusColor, getStatusLabel } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface Service {
  id: string;
  name: string;
  timezone: string;
}

interface Reservation {
  id: number;
  serviceId: string;
  service: Service | null;
  slotStart: string;
  slotEnd: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  customerName: string | null;
  createdAt: string;
}

export default function MisReservasPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  useEffect(() => {
    const token = getMemberToken();
    if (!token) {
      router.replace('/portal/login?redirect=/portal/mis-reservas');
      return;
    }

    fetch(`${BASE}/members/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/portal/login?redirect=/portal/mis-reservas');
          setLoading(false);
          return;
        }
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || 'Error');
        setReservations(json.data ?? json);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudieron cargar las reservas.');
        setLoading(false);
      });
  }, [router]);

  const handleCancel = async (id: number) => {
    const token = getMemberToken();
    if (!token) return;
    setCancellingId(id);
    try {
      const res = await fetch(`${BASE}/members/reservations/${id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Error al cancelar');
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
      );
    } catch (e: any) {
      setError(e.message || 'Error al cancelar la reserva.');
    } finally {
      setCancellingId(null);
      setConfirmCancelId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-400">Cargando reservas...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis reservas</h1>
          <p className="text-gray-500 text-sm mt-1">Historial de todas tus reservas</p>
        </div>
        <Link href="/portal" className="text-sm text-blue-600 hover:underline">
          Buscar centros
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-5 py-4 mb-6">
          {error}
        </div>
      )}

      {reservations.length === 0 && !error && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-lg mb-2">No tienes reservas aún</p>
          <Link href="/portal" className="text-blue-600 hover:underline text-sm">
            Buscar centros y reservar
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {reservations.map((r) => {
          const tz = r.service?.timezone ?? 'UTC';
          const isActive = r.status === 'confirmed' || r.status === 'pending';
          const isConfirming = confirmCancelId === r.id;
          const isCancelling = cancellingId === r.id;

          return (
            <div
              key={r.id}
              className="border border-gray-100 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {r.service?.name ?? 'Evento'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatSlotDate(r.slotStart, tz)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatSlotTime(r.slotStart, tz)} — {formatSlotTime(r.slotEnd, tz)}
                  </p>
                  {r.customerName && (
                    <p className="text-xs text-gray-400 mt-1">{r.customerName}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(r.status)}`}
                  >
                    {getStatusLabel(r.status)}
                  </span>
                  {isActive && (
                    isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">¿Cancelar?</span>
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={isCancelling}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg disabled:opacity-50"
                        >
                          {isCancelling ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(r.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Cancelar reserva
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

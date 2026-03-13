import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const DAY_OPTIONS = Object.entries(DAY_NAMES).map(([value, label]) => ({
  value: Number(value),
  label,
}));

export function formatTime(time: string): string {
  return time.substring(0, 5); // '08:00:00' → '08:00'
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function formatSlotTime(iso: string, timezone?: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
  } catch {
    return iso;
  }
}

export function formatSlotDate(iso: string, timezone?: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  } catch {
    return iso;
  }
}

export function getAvailabilityColor(available: number, capacity: number): string {
  if (available === 0) return 'text-red-600 bg-red-50';
  const pct = available / capacity;
  if (pct <= 0.25) return 'text-orange-600 bg-orange-50';
  if (pct <= 0.5) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'text-green-700 bg-green-100';
    case 'pending': return 'text-yellow-700 bg-yellow-100';
    case 'cancelled': return 'text-gray-500 bg-gray-100';
    default: return 'text-gray-700 bg-gray-100';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmada';
    case 'pending': return 'Pendiente';
    case 'cancelled': return 'Cancelada';
    default: return status;
  }
}

export function todayAsString(): string {
  return new Date().toISOString().split('T')[0];
}

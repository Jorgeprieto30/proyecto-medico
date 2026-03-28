'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, ChevronRight, ArrowLeft, CalendarDays, Clock, Search, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { availabilityApi, reservationsApi, membersAdminApi } from '@/lib/api';
import type { SlotAvailability, Service, MemberSummary } from '@/types';
import { validateRut } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types & constants ─────────────────────────────────────────────────────────

type Step = 'date' | 'slots' | 'form';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const WEEKDAY_SHORT = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

const reserveSchema = z.object({
  spot_number: z.coerce.number().min(1, 'Selecciona un cupo'),
});
type ReserveForm = z.infer<typeof reserveSchema>;

const createClientSchema = z.object({
  first_name: z.string().min(1, 'Requerido'),
  last_name:  z.string().min(1, 'Requerido'),
  email:      z.string().email('Email inválido'),
  rut:        z.string().optional().refine((v) => !v || validateRut(v), { message: 'RUT inválido' }),
  birth_date: z.string().optional(),
});
type CreateClientForm = z.infer<typeof createClientSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDowOfMonth(year: number, month: number) {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function fmtTime(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit', timeZone: tz ?? 'UTC',
  });
}
function fmtDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function dotColor(available: number, capacity: number): string {
  if (capacity === 0) return 'bg-gray-200';
  if (available === 0) return 'bg-red-400';
  const pct = available / capacity;
  if (pct <= 0.25) return 'bg-orange-400';
  return 'bg-green-400';
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BookingModal({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const today = todayStr();
  const todayDate = new Date(today + 'T12:00:00');

  const [step, setStep]               = useState<Step>('date');
  const [year, setYear]               = useState(todayDate.getFullYear());
  const [month, setMonth]             = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);

  // Client selection state
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown]     = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReserveForm>({
    resolver: zodResolver(reserveSchema),
  });

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
  });

  // ── Search members query ─────────────────────────────────────────────────────
  const { data: searchResults = [] } = useQuery({
    queryKey: ['members-search', debouncedQuery],
    queryFn: () => membersAdminApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  // ── Create member mutation ───────────────────────────────────────────────────
  const createMemberMutation = useMutation({
    mutationFn: (data: CreateClientForm) => membersAdminApi.create({
      first_name: data.first_name,
      last_name:  data.last_name,
      email:      data.email,
      rut:        data.rut || undefined,
      birth_date: data.birth_date || undefined,
    }),
    onSuccess: (member) => {
      setSelectedMember(member);
      setShowCreateForm(false);
      resetCreate();
      toast.success(`Cliente ${member.first_name} ${member.last_name} registrado`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Reserve mutation ─────────────────────────────────────────────────────────
  const reserveMutation = useMutation({
    mutationFn: (data: ReserveForm) =>
      reservationsApi.create({
        service_id: service!.id,
        slot_start: selectedSlot!.slot_start,
        spot_number: data.spot_number,
        customer_name: `${selectedMember!.first_name} ${selectedMember!.last_name}`,
        customer_external_id: selectedMember!.rut ?? undefined,
        metadata: { member_id: selectedMember!.id },
      }),
    onSuccess: () => {
      toast.success('Reserva creada correctamente');
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['reservations-all'] });
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClose = () => {
    setStep('date');
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedMember(null);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowCreateForm(false);
    reset();
    resetCreate();
    onClose();
  };

  // ── Month navigation ──────────────────────────────────────────────────────────
  const numDays = daysInMonth(year, month);
  const allDays = useMemo(
    () => Array.from({ length: numDays }, (_, i) => toDateStr(year, month, i + 1)),
    [year, month, numDays],
  );

  const { data: monthData } = useQuery({
    queryKey: ['month-availability', service?.id, year, month],
    queryFn: async () => {
      const results: Record<string, { available: number; capacity: number }> = {};
      await Promise.all(
        allDays.map(async (d) => {
          try {
            const slots = await availabilityApi.byDate(service!.id, d);
            const available = slots.reduce((s, sl) => s + sl.available, 0);
            const capacity  = slots.reduce((s, sl) => s + sl.capacity, 0);
            if (capacity > 0) results[d] = { available, capacity };
          } catch { /* no slots */ }
        }),
      );
      return results;
    },
    enabled: !!service && step === 'date',
    staleTime: 60_000,
  });

  const { data: daySlots, isLoading: loadingSlots } = useQuery({
    queryKey: ['availability', service?.id, selectedDate],
    queryFn: () => availabilityApi.byDate(service!.id, selectedDate!),
    enabled: !!service && !!selectedDate && step === 'slots',
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const selectDate = (d: string) => {
    if (d < today) return;
    setSelectedDate(d);
    setStep('slots');
  };

  const selectSlot = (slot: SlotAvailability) => {
    if (!slot.bookable) return;
    setSelectedSlot(slot);
    reset();
    setStep('form');
  };

  const selectMember = (m: MemberSummary) => {
    setSelectedMember(m);
    setSearchQuery('');
    setShowDropdown(false);
    setShowCreateForm(false);
  };

  const titles: Record<Step, string> = {
    date:  `Reservar — ${service?.name ?? ''}`,
    slots: `Horarios — ${selectedDate ? fmtDateLong(selectedDate) : ''}`,
    form:  'Datos de la reserva',
  };

  return (
    <Modal
      open={!!service}
      onClose={handleClose}
      title={titles[step]}
      className="max-w-lg"
    >
      {/* ── Step 1: Calendar ── */}
      {step === 'date' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_SHORT.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstDowOfMonth(year, month) }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {allDays.map((dateStr) => {
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const isPast = dateStr < today;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const info = monthData?.[dateStr];
              const hasDot = !!info;
              const noSlots = !!monthData && !info;
              const disabled = isPast || noSlots;
              return (
                <button
                  key={dateStr}
                  onClick={() => selectDate(dateStr)}
                  disabled={disabled}
                  className={`flex flex-col items-center py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                    ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-700 font-semibold' : !disabled ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-700'}
                  `}
                >
                  <span className="text-sm leading-none">{dayNum}</span>
                  {hasDot && !isPast ? (
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor(info.available, info.capacity)}`} />
                  ) : (
                    <span className="mt-1 w-1.5 h-1.5" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 border-t">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Disponible</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Casi lleno</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Sin cupos</span>
          </div>
        </div>
      )}

      {/* ── Step 2: Slots ── */}
      {step === 'slots' && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('date')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al calendario
          </button>
          {loadingSlots ? (
            <div className="text-center py-8 text-sm text-gray-400">Cargando horarios...</div>
          ) : !daySlots?.length ? (
            <div className="text-center py-8 text-sm text-gray-400">
              Sin horarios configurados para este día.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {daySlots.map((slot) => {
                const start = fmtTime(slot.slot_start, service?.timezone);
                const end   = fmtTime(slot.slot_end,   service?.timezone);
                const pct   = slot.capacity > 0 ? (slot.available / slot.capacity) * 100 : 0;
                const barColor = slot.available === 0 ? 'bg-red-400' : pct <= 25 ? 'bg-orange-400' : 'bg-green-400';
                return (
                  <button
                    key={slot.slot_start}
                    onClick={() => selectSlot(slot)}
                    disabled={!slot.bookable}
                    className={`text-left border rounded-xl p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                      ${slot.bookable ? 'hover:border-blue-400 hover:shadow-md hover:bg-blue-50/40 cursor-pointer' : ''}
                    `}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {start} – {end}
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={`mt-1.5 text-xs font-medium ${slot.available === 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {slot.available === 0
                        ? 'Sin cupos'
                        : `${slot.available} de ${slot.capacity} disponibles`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Form ── */}
      {step === 'form' && selectedSlot && (
        <div className="space-y-5">
          <button
            onClick={() => setStep('slots')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a horarios
          </button>

          {/* Summary card */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Reserva para</p>
            <p className="font-semibold text-blue-900">{service?.name}</p>
            <div className="flex items-center gap-3 text-sm text-blue-700">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {selectedDate ? fmtDateLong(selectedDate) : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {fmtTime(selectedSlot.slot_start, service?.timezone)} – {fmtTime(selectedSlot.slot_end, service?.timezone)}
              </span>
            </div>
            <p className="text-xs text-blue-600">{selectedSlot.available} cupo{selectedSlot.available !== 1 ? 's' : ''} disponible{selectedSlot.available !== 1 ? 's' : ''}</p>
          </div>

          {/* ── Client selector ── */}
          <div className="space-y-3">
            <Label>Cliente *</Label>

            {selectedMember ? (
              /* Selected member chip */
              <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {selectedMember.email}{selectedMember.rut ? ` · ${selectedMember.rut}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="p-1 rounded-full hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* Search + create */
              <div className="space-y-2">
                <div className="relative" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Buscar por nombre, RUT o email..."
                    className="pl-9"
                  />
                  {showDropdown && debouncedQuery.length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                      ) : (
                        searchResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onMouseDown={() => selectMember(m)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b last:border-b-0"
                          >
                            <p className="text-sm font-medium text-gray-800">
                              {m.first_name} {m.last_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {m.email}{m.rut ? ` · ${m.rut}` : ''}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setShowCreateForm((v) => !v); setShowDropdown(false); }}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  {showCreateForm ? 'Cancelar' : 'Registrar cliente nuevo'}
                </button>

                {showCreateForm && (
                  <form
                    onSubmit={handleSubmitCreate((d) => createMemberMutation.mutate(d))}
                    className="border rounded-lg p-4 bg-gray-50 space-y-3 mt-2"
                  >
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nuevo cliente</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nombre *</Label>
                        <Input {...registerCreate('first_name')} className="mt-0.5 h-8 text-sm" placeholder="María" />
                        {createErrors.first_name && <p className="text-xs text-red-500 mt-0.5">{createErrors.first_name.message}</p>}
                      </div>
                      <div>
                        <Label className="text-xs">Apellido *</Label>
                        <Input {...registerCreate('last_name')} className="mt-0.5 h-8 text-sm" placeholder="González" />
                        {createErrors.last_name && <p className="text-xs text-red-500 mt-0.5">{createErrors.last_name.message}</p>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Email *</Label>
                      <Input type="email" {...registerCreate('email')} className="mt-0.5 h-8 text-sm" placeholder="maria@ejemplo.com" />
                      {createErrors.email && <p className="text-xs text-red-500 mt-0.5">{createErrors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">RUT (opcional)</Label>
                        <Input {...registerCreate('rut')} className="mt-0.5 h-8 text-sm" placeholder="12.345.678-9" />
                        {createErrors.rut && <p className="text-xs text-red-500 mt-0.5">{createErrors.rut.message}</p>}
                      </div>
                      <div>
                        <Label className="text-xs">Fecha nacimiento (opcional)</Label>
                        <Input type="date" {...registerCreate('birth_date')} className="mt-0.5 h-8 text-sm" />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full"
                      disabled={createMemberMutation.isPending}
                    >
                      {createMemberMutation.isPending ? 'Registrando...' : 'Registrar cliente'}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* ── Spot + confirm (only when member selected) ── */}
          {selectedMember && (
            <form onSubmit={handleSubmit((d) => reserveMutation.mutate(d))} className="space-y-4">
              <div>
                <Label>Número de cupo * {service?.spotLabel && `(${service.spotLabel})`}</Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedSlot.capacity}
                  {...register('spot_number')}
                  className="mt-1"
                  placeholder={`1 – ${selectedSlot.capacity}`}
                />
                {errors.spot_number && <p className="text-xs text-red-500 mt-1">{errors.spot_number.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={reserveMutation.isPending}>
                {reserveMutation.isPending ? 'Reservando...' : 'Confirmar reserva'}
              </Button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

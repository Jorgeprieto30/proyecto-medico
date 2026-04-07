'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Check, Zap, Rocket, Star, CreditCard, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function apiFetch(path: string, options: RequestInit = {}) {
  const session = await getSession();
  const token = (session as any)?.accessToken;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) signOut({ callbackUrl: '/login' });
    throw new Error(json.message || `Error ${res.status}`);
  }
  return json.data ?? json;
}

interface UserProfile {
  subscription_status: 'trial' | 'starter' | 'active' | 'past_due' | 'cancelled';
  trial_reservation_count: number;
  name: string;
  email: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  trial: { label: 'Trial', variant: 'warning' },
  starter: { label: 'Básico', variant: 'success' },
  active: { label: 'Pro', variant: 'success' },
  past_due: { label: 'Pago vencido', variant: 'danger' },
  cancelled: { label: 'Cancelado', variant: 'muted' },
};

const plans = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Gratis',
    description: 'Para explorar la plataforma',
    features: [
      '1 evento activo',
      'Hasta 3 reservas totales',
      'Portal público de reservas',
      'API key incluida',
    ],
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 border-yellow-200',
    targetStatus: 'trial' as const,
  },
  {
    id: 'starter',
    name: 'Básico',
    price: '$30 / mes',
    description: 'Para instructores y centros pequeños',
    features: [
      'Hasta 3 eventos activos',
      'Hasta 20 cupos por evento',
      'Portal público de reservas',
      'API key incluida',
    ],
    icon: Star,
    color: 'text-purple-500',
    bg: 'bg-purple-50 border-purple-200',
    targetStatus: 'starter' as const,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$39 / mes',
    description: 'Para centros en crecimiento',
    features: [
      'Hasta 10 eventos activos',
      'Hasta 50 cupos por evento',
      'Portal público de reservas',
      'Múltiples API keys',
      'Soporte prioritario',
    ],
    icon: Rocket,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    targetStatus: 'active' as const,
    highlighted: true,
  },
];

export default function PlansPage() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['user-me'],
    queryFn: () => apiFetch('/users/me'),
  });

  const planMutation = useMutation({
    mutationFn: (status: 'trial' | 'starter' | 'active') =>
      apiFetch('/users/me/plan', {
        method: 'PATCH',
        body: JSON.stringify({ subscription_status: status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-me'] });
      toast.success('Plan actualizado correctamente');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  const currentStatus = user?.subscription_status ?? 'trial';
  const statusInfo = STATUS_LABELS[currentStatus];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Planes</h1>
        <p className="text-gray-500 text-sm mt-1">Administra tu suscripción y accede a todas las funciones</p>
      </div>

      {/* Estado actual */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Plan actual</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              {currentStatus === 'trial' && (
                <span className="text-xs text-gray-400">
                  {user?.trial_reservation_count ?? 0}/3 reservas usadas
                </span>
              )}
            </div>
          </div>

          {(currentStatus === 'past_due' || currentStatus === 'cancelled') && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                {currentStatus === 'past_due'
                  ? 'Tu pago está vencido. Tienes 5 días de gracia antes de que tus servicios sean ocultados.'
                  : 'Tu suscripción está cancelada. Contrata un plan para reactivar tus servicios.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjetas de planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const planOrder = { trial: 0, starter: 1, active: 2 };
          const currentOrder = planOrder[currentStatus as keyof typeof planOrder] ?? 0;
          const planStatusOrder = planOrder[plan.targetStatus];
          const isCurrent = currentStatus === plan.targetStatus;
          const isUpgrade = planStatusOrder > currentOrder;
          const isDowngrade = planStatusOrder < currentOrder;

          const ctaLabel: Record<string, string> = {
            trial: 'Contratar Básico',
            starter: 'Contratar Básico',
            active: 'Contratar Pro',
          };

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 flex flex-col gap-4 ${
                plan.highlighted
                  ? 'border-blue-400 shadow-md shadow-blue-100'
                  : 'border-gray-200'
              } ${isCurrent ? plan.bg : 'bg-white'}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Recomendado
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.highlighted ? 'bg-blue-100' : plan.targetStatus === 'starter' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <Icon className={`h-5 w-5 ${plan.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                </div>
              </div>

              <div>
                <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                {isCurrent ? (
                  <div className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">
                    <Check className="h-4 w-4" />
                    Plan actual
                  </div>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => planMutation.mutate(plan.targetStatus as 'starter' | 'active')}
                    disabled={planMutation.isPending}
                  >
                    {planMutation.isPending ? 'Procesando...' : ctaLabel[plan.targetStatus]}
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => planMutation.mutate(plan.targetStatus as 'trial' | 'starter')}
                    disabled={planMutation.isPending}
                  >
                    {planMutation.isPending ? 'Procesando...' : `Cambiar a ${plan.name}`}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla comparativa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparativa de planes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-t border-b bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Característica</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500 text-xs uppercase tracking-wide">Trial</th>
                <th className="px-5 py-3 text-center font-medium text-purple-600 text-xs uppercase tracking-wide">Básico</th>
                <th className="px-5 py-3 text-center font-medium text-blue-600 text-xs uppercase tracking-wide">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {[
                ['Precio', 'Gratis', '$30 / mes', '$39 / mes'],
                ['Eventos activos', '1', '3', '10'],
                ['Cupos por evento', '—', '20', '50'],
                ['Reservas totales', '3', 'Ilimitadas', 'Ilimitadas'],
                ['Portal de reservas', '✓', '✓', '✓'],
                ['API keys', '1', '1', 'Múltiples'],
                ['Soporte', 'Comunidad', 'Email', 'Prioritario'],
              ].map(([feat, trial, starter, pro]) => (
                <tr key={feat} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{feat}</td>
                  <td className="px-5 py-3 text-center text-gray-500">{trial}</td>
                  <td className="px-5 py-3 text-center text-purple-600 font-medium">{starter}</td>
                  <td className="px-5 py-3 text-center text-blue-600 font-medium">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

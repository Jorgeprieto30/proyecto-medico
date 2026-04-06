'use client';

import { useQuery } from '@tanstack/react-query';
import { getSession, signOut } from 'next-auth/react';
import { Users, Building2, Search } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  center_name: string | null;
  center_code: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled';
  trial_reservation_count: number;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  trial: { label: 'Trial', variant: 'warning' },
  active: { label: 'Activo', variant: 'success' },
  past_due: { label: 'Pago vencido', variant: 'danger' },
  cancelled: { label: 'Cancelado', variant: 'muted' },
};

export default function UsersPage() {
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery<PlatformUser[]>({
    queryKey: ['platform-users'],
    queryFn: () => apiFetch('/users'),
  });

  if (isLoading) return <PageSpinner />;

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.center_name ?? '').toLowerCase().includes(q) ||
      (u.center_code ?? '').toLowerCase().includes(q)
    );
  });

  const counts = {
    total: users?.length ?? 0,
    active: users?.filter((u) => u.subscription_status === 'active').length ?? 0,
    trial: users?.filter((u) => u.subscription_status === 'trial').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">Todos los centros registrados en la plataforma</p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total usuarios', value: counts.total, icon: Users, color: 'text-gray-600' },
          { label: 'Con plan activo', value: counts.active, icon: Users, color: 'text-green-600' },
          { label: 'En trial', value: counts.trial, icon: Users, color: 'text-yellow-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-base">Centros registrados</CardTitle>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!filtered.length ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              {search ? 'Sin resultados para tu búsqueda.' : 'No hay usuarios registrados aún.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-t border-b bg-gray-50">
                <tr>
                  {['Usuario', 'Centro', 'Código', 'Plan', 'Reservas trial', 'Registrado'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => {
                  const status = STATUS_BADGE[u.subscription_status] ?? { label: u.subscription_status, variant: 'muted' as const };
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {u.center_name ?? <span className="text-gray-300 italic">Sin nombre</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.center_code ? (
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                            {u.center_code}
                          </code>
                        ) : (
                          <span className="text-gray-300 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.subscription_status === 'trial'
                          ? `${u.trial_reservation_count}/3`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-CL')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

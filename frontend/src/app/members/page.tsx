'use client';

import { useQuery } from '@tanstack/react-query';
import { getSession, signOut } from 'next-auth/react';
import { Users, Search } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rut: string | null;
  first_reservation_at: string;
  last_reservation_at: string;
  total_reservations: number;
}

export default function MembersPage() {
  const [search, setSearch] = useState('');

  const { data: visitors, isLoading } = useQuery<Visitor[]>({
    queryKey: ['my-visitors'],
    queryFn: () => apiFetch('/members/my-visitors'),
  });

  if (isLoading) return <PageSpinner />;

  const filtered = (visitors ?? []).filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${v.first_name} ${v.last_name}`.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      (v.rut ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">
          Personas que han visitado tu portal al menos una vez
        </p>
      </div>

      {/* Métrica */}
      <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 border border-blue-100 rounded-xl w-fit">
        <Users className="h-5 w-5 text-blue-500" />
        <div>
          <p className="text-2xl font-bold text-gray-900">{visitors?.length ?? 0}</p>
          <p className="text-xs text-gray-500">visitantes totales</p>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Visitantes de tu centro</CardTitle>
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
              {search
                ? 'Sin resultados para tu búsqueda.'
                : 'Ningún usuario ha hecho una reserva en tu centro aún.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-t border-b bg-gray-50">
                <tr>
                  {['Nombre', 'Email', 'RUT', 'Primera reserva', 'Última reserva', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {v.first_name} {v.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {v.rut ?? <span className="text-gray-300 font-sans italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(v.first_reservation_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(v.last_reservation_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-blue-600">
                      {v.total_reservations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

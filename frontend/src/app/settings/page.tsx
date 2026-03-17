'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSession } from 'next-auth/react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json.data ?? json;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  key_value: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});
type FormData = z.infer<typeof schema>;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Copiar">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function KeyCell({ keyValue, prefix }: { keyValue: string | null; prefix: string }) {
  const [revealed, setRevealed] = useState(false);

  if (!keyValue) {
    return (
      <span className="text-xs text-gray-400 italic">
        {prefix}… <span className="text-gray-300">(clave anterior — crea una nueva para copiarla)</span>
      </span>
    );
  }

  const display = revealed ? keyValue : `${keyValue.slice(0, 12)}${'•'.repeat(16)}`;

  return (
    <div className="flex items-center gap-1">
      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 max-w-[260px] truncate block">
        {display}
      </code>
      <button onClick={() => setRevealed((v) => !v)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title={revealed ? 'Ocultar' : 'Revelar'}>
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <CopyButton value={keyValue} />
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => apiFetch('/api-keys'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiFetch('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setModalOpen(false);
      reset();
      toast.success('API key creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revocada');
      setRevokeId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Administra las claves de acceso a la API</p>
      </div>

      {/* Sección API Keys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-base">API Keys</CardTitle>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva clave
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!keys?.length ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              No tienes claves creadas aún.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-t border-b bg-gray-50">
                <tr>
                  {['Nombre', 'Clave', 'Estado', 'Último uso', 'Creada', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3">
                      <KeyCell keyValue={k.key_value} prefix={k.prefix} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={k.is_active ? 'success' : 'muted'}>
                        {k.is_active ? 'Activa' : 'Revocada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString('es-CL')
                        : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(k.created_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3">
                      {k.is_active && (
                        <button
                          onClick={() => setRevokeId(k.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Revocar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Sección de uso */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cómo usar la API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Incluye la clave en el header <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">X-Api-Key</code> de cada request:
          </p>
          <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto">
{`curl https://proyecto-medico-production-dc07.up.railway.app/api/v1/services \\
  -H "X-Api-Key: ak_tu_clave_aqui"`}
          </pre>
        </CardContent>
      </Card>

      {/* Modal crear */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva API key">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre de la clave</Label>
            <Input
              id="name"
              {...register('name')}
              className="mt-1"
              placeholder="ej: App móvil, Integración web..."
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <p className="text-xs text-gray-500">
            Dale un nombre descriptivo para identificar desde dónde se usa esta clave.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear clave'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm revocar */}
      <ConfirmDialog
        open={!!revokeId}
        title="Revocar API key"
        description="Esta acción es irreversible. Cualquier app que use esta clave dejará de funcionar."
        confirmLabel="Revocar"
        variant="destructive"
        onConfirm={() => revokeId && revokeMutation.mutate(revokeId)}
        onClose={() => setRevokeId(null)}
      />
    </div>
  );
}

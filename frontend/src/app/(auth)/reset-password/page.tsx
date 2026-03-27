'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
});
type Form = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-red-600">Enlace inválido o expirado.</p>
        <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline block">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Contraseña actualizada</h2>
        <p className="text-sm text-gray-500">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium block pt-2">
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: Form) => {
    setServerError('');
    try {
      const res = await fetch(`${BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          setServerError('Este enlace ya no es válido o ha expirado. Solicita uno nuevo.');
        } else {
          setServerError(json.message || 'Error al restablecer la contraseña.');
        }
        return;
      }
      setDone(true);
    } catch {
      setServerError('Error de conexión. Intenta nuevamente.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Nueva contraseña</h2>
        <p className="text-sm text-gray-500 mt-1">Elige una contraseña segura de al menos 8 caracteres.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">
            {serverError}{' '}
            {serverError.includes('expirado') && (
              <Link href="/forgot-password" className="underline font-medium">Solicitar nuevo enlace</Link>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
          <input
            {...register('password')}
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
          <input
            {...register('confirm')}
            type="password"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
          {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ background: 'linear-gradient(90deg, #5ba3d9 0%, #5bbfb2 100%)' }}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

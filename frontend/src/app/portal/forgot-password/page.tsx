'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const schema = z.object({ email: z.string().email('Email inválido') });
type Form = z.infer<typeof schema>;

function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setServerError('');
    try {
      const res = await fetch(`${BASE}/members/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      if (!res.ok) {
        const json = await res.json();
        setServerError(json.message || 'Error al procesar la solicitud.');
        return;
      }
      setSent(true);
    } catch {
      setServerError('Error de conexión. Intenta nuevamente.');
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Revisa tu correo</h2>
        <p className="text-sm text-gray-500">
          Si el email está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
        </p>
        <Link href="/portal/login" className="text-sm text-blue-600 hover:underline font-medium block pt-2">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{serverError}</p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="correo@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/portal/login" className="text-blue-600 hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

export default function PortalForgotPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

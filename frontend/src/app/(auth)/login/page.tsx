'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

// ─── Campus Logo ───────────────────────────────────────────────────────────────

function CampusLogo() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Calendar icon */}
      <div className="relative w-24 h-24">
        {/* Shadow / border layer */}
        <div className="absolute bottom-0 right-0 w-[72px] h-[72px] rounded-[20px] bg-blue-200/60 border-2 border-blue-300" />
        {/* Main white card */}
        <div className="absolute top-0 left-0 w-[72px] h-[72px] bg-white rounded-[20px] shadow-xl flex flex-col items-center justify-center gap-2">
          {/* Binding tabs */}
          <div className="flex gap-2.5 -mt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-3.5 bg-blue-400 rounded-full" />
            ))}
          </div>
          {/* Grid cells */}
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-3.5 h-3.5 bg-gray-100 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* "campus" wordmark */}
      <span
        className="text-4xl font-bold tracking-tight"
        style={{
          background: 'linear-gradient(90deg, #5ba3d9 0%, #6dbfb0 50%, #b8a898 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        campus
      </span>
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Email o contraseña incorrectos');
    } else {
      router.refresh();
      router.push(callbackUrl);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <CampusLogo />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Iniciar sesión</h1>
          <p className="text-sm text-gray-400 mt-1">Ingresa a tu cuenta de administrador</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{
              background: 'linear-gradient(90deg, #5ba3d9 0%, #5bbfb2 100%)',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-blue-500 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

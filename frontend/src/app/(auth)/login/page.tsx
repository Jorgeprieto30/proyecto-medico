'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { memberLogin } from '@/lib/member-auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ─── Campus Logo ───────────────────────────────────────────────────────────────

function CampusLogo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-24 h-24">
        <div className="absolute bottom-0 right-0 w-[72px] h-[72px] rounded-[20px] bg-blue-200/60 border-2 border-blue-300" />
        <div className="absolute top-0 left-0 w-[72px] h-[72px] bg-white rounded-[20px] shadow-xl flex flex-col items-center justify-center gap-2">
          <div className="flex gap-2.5 -mt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-3.5 bg-blue-400 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-3.5 h-3.5 bg-gray-100 rounded-md" />
            ))}
          </div>
        </div>
      </div>
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

// ─── Admin form ────────────────────────────────────────────────────────────────

const adminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type AdminData = z.infer<typeof adminSchema>;

function AdminLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<AdminData>({
    resolver: zodResolver(adminSchema),
  });

  const onSubmit = async (data: AdminData) => {
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

  const handleGoogle = () => signIn('google', { callbackUrl });

  return (
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
        style={{ background: 'linear-gradient(90deg, #5ba3d9 0%, #5bbfb2 100%)' }}
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center">
          <span className="text-xs text-gray-400 bg-white px-2">o continúa con</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continuar con Google
      </button>

      <p className="text-center text-sm text-gray-400 pt-1">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="font-medium text-blue-500 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

// ─── Member form ───────────────────────────────────────────────────────────────

const memberSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type MemberData = z.infer<typeof memberSchema>;

function MemberLoginForm({ redirect }: { redirect: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<MemberData>({
    resolver: zodResolver(memberSchema),
  });

  const onSubmit = async (data: MemberData) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/members/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || 'Email o contraseña incorrectos');
        return;
      }
      const d = json.data ?? json;
      memberLogin(d.access_token, d.member);
      router.push(redirect);
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="jorge@example.com"
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
        style={{ background: 'linear-gradient(90deg, #5ba3d9 0%, #5bbfb2 100%)' }}
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-center text-sm text-gray-400 pt-1">
        ¿No tienes cuenta?{' '}
        <Link href="/portal/register" className="font-medium text-blue-500 hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </form>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'member' | 'admin';

function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [tab, setTab] = useState<Tab>('member');

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8">
        <CampusLogo />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('member')}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
              tab === 'member'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/40'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Soy cliente
          </button>
          <button
            onClick={() => setTab('admin')}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
              tab === 'admin'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/40'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Soy administrador
          </button>
        </div>

        {/* Form */}
        <div className="p-8">
          {tab === 'member' ? (
            <>
              <div className="mb-5">
                <h1 className="text-xl font-semibold text-gray-900">Ingresa a tu cuenta</h1>
                <p className="text-sm text-gray-400 mt-1">Reserva y gestiona tus citas</p>
              </div>
              <MemberLoginForm redirect="/portal" />
            </>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-xl font-semibold text-gray-900">Panel administrativo</h1>
                <p className="text-sm text-gray-400 mt-1">Gestiona las reservas de tu local</p>
              </div>
              <AdminLoginForm callbackUrl={callbackUrl} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

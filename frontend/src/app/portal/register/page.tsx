'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { memberLogin } from '@/lib/member-auth';
import { validateRut } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function PortalRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/portal';

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    rut: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = 'Nombre requerido';
    if (!form.last_name.trim()) errs.last_name = 'Apellido requerido';
    if (!form.email.includes('@')) errs.email = 'Email inválido';
    if (form.rut && !validateRut(form.rut)) errs.rut = 'RUT inválido (ej: 12.345.678-9)';
    if (form.password.length < 6) errs.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError('');
    setLoading(true);

    try {
      const body: Record<string, string> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      if (form.rut.trim()) body.rut = form.rut.trim();

      const res = await fetch(`${BASE}/members/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(
          Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al registrarse',
        );
        return;
      }
      const data = json.data ?? json;
      memberLogin(data.access_token, data.member);
      router.push(redirect);
    } catch {
      setServerError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, type = 'text', placeholder = '', required = true) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {!required && <span className="text-gray-400 font-normal">(opcional)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={(form as any)[id]}
        onChange={(e) => set(id, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {errors[id] && <p className="text-xs text-red-500 mt-1">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Crea tu cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Portal de reservas campus</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          {field('first_name', 'Nombre', 'text', 'Jorge')}
          {field('last_name', 'Apellido', 'text', 'Prieto')}
          {field('email', 'Correo electrónico', 'email', 'jorge@example.com')}
          {field('rut', 'RUT', 'text', '12.345.678-9', false)}
          {field('password', 'Contraseña', 'password', '••••••••')}

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/portal/login" className="text-blue-600 hover:underline font-medium">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  );
}

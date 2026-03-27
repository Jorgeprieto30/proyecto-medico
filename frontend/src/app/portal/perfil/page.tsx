'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMemberToken, getMemberProfile, updateMemberProfile, memberLogout } from '@/lib/member-auth';
import { validateRut, normalizeRut } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function PerfilPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [rut, setRut]             = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail]         = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError]       = useState('');
  const [passwordSuccess, setPasswordSuccess]   = useState('');
  const [savingPassword, setSavingPassword]     = useState(false);

  useEffect(() => {
    const t = getMemberToken();
    if (!t) {
      router.replace('/portal/login?redirect=/portal/perfil');
      return;
    }
    setToken(t);
    // Load basic display info from localStorage (non-sensitive)
    const cached = getMemberProfile();
    if (cached) {
      setFirstName(cached.first_name);
      setLastName(cached.last_name);
      setEmail(cached.email);
    }
    // Fetch full profile from API to get rut and birth_date (not stored in localStorage)
    fetch(`${BASE}/members/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json) return;
        const member = json.data ?? json;
        setFirstName(member.first_name ?? '');
        setLastName(member.last_name ?? '');
        setEmail(member.email ?? '');
        setRut(member.rut ?? '');
        setBirthDate(member.birth_date ?? '');
      })
      .catch(() => {/* silently ignore — cached values are shown */});
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (rut && !validateRut(rut)) {
      setProfileError('RUT inválido (ej: 12.345.678-9)');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await fetch(`${BASE}/members/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          rut: rut.trim() ? normalizeRut(rut.trim()) : undefined,
          birth_date: birthDate || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.replace('/portal/login?redirect=/portal/perfil');
        return;
      }
      if (!res.ok) {
        setProfileError(Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al guardar');
        return;
      }
      const member = json.data ?? json;
      updateMemberProfile(member);
      setProfileSuccess('Perfil actualizado correctamente.');
    } catch {
      setProfileError('Error de conexión. Intenta nuevamente.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      const res = await fetch(`${BASE}/members/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.replace('/portal/login?redirect=/portal/perfil');
        return;
      }
      if (!res.ok) {
        setPasswordError(Array.isArray(json.message) ? json.message.join(', ') : json.message || 'Error al cambiar contraseña');
        return;
      }
      setPasswordSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch {
      setPasswordError('Error de conexión. Intenta nuevamente.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    memberLogout();
    router.push('/');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-gray-500 text-sm mt-1">{email}</p>
        </div>
        <Link href="/portal/mis-reservas" className="text-sm text-blue-600 hover:underline">
          Mis reservas
        </Link>
      </div>

      {/* Profile form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Datos personales</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{profileSuccess}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de nacimiento <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* Password form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Cambiar contraseña</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{passwordSuccess}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>

      {/* Logout */}
      <div className="text-center">
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMemberProfile, getMemberToken, memberLogout, type MemberProfile } from '@/lib/member-auth';
import { useRouter, usePathname } from 'next/navigation';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/portal/login', '/portal/register'];

function CampusHeaderLogo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Mini calendar icon */}
      <div className="relative w-9 h-9">
        <div className="absolute bottom-0 right-0 w-7 h-7 rounded-lg bg-blue-200/60" />
        <div className="absolute top-0 left-0 w-7 h-7 bg-white rounded-lg shadow-md flex flex-col items-center justify-center gap-1">
          <div className="flex gap-1 -mt-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-[3px] h-[5px] bg-blue-400 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[4px] h-[4px] bg-gray-200 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
      {/* Brand text */}
      <span
        className="text-xl font-bold tracking-tight"
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

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const token = getMemberToken();
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!token && !isPublic) {
      router.replace(`/portal/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setProfile(getMemberProfile());
    setMounted(true);
  }, [pathname, router]);

  const handleLogout = () => {
    memberLogout();
    setProfile(null);
    router.push('/');
  };

  // Don't render protected content until auth is confirmed
  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (!mounted && !isPublic) return null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/portal" className="flex items-center">
            <CampusHeaderLogo />
          </Link>
          <nav className="flex items-center gap-3">
            {mounted && profile ? (
              <>
                <Link
                  href="/portal/mis-reservas"
                  className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Mis reservas
                </Link>
                <Link
                  href="/portal/perfil"
                  className="text-sm text-gray-700 font-medium hover:text-blue-600 transition-colors hidden sm:inline"
                >
                  {profile.first_name} {profile.last_name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/portal/login"
                  className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Ingresar
                </Link>
                <Link
                  href="/portal/register"
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

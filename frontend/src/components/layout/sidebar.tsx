'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classes', label: 'Eventos', icon: Dumbbell },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/reservations', label: 'Actividad', icon: ClipboardList },
  { href: '/api-docs', label: 'API Docs', icon: BookOpen },
  { href: '/settings', label: 'Configuración', icon: KeyRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-[#0d1526] flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e3052]">
        {/* Mini campus calendar icon */}
        <div className="relative w-9 h-9 shrink-0">
          <div className="absolute bottom-0 right-0 w-7 h-7 rounded-lg bg-blue-400/30 border border-blue-400/50" />
          <div className="absolute top-0 left-0 w-7 h-7 bg-white rounded-lg shadow flex flex-col items-center justify-center gap-0.5">
            <div className="flex gap-0.5 -mt-1">
              {[0,1,2].map(i => <div key={i} className="w-0.5 h-1.5 bg-blue-400 rounded-full" />)}
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {[...Array(6)].map((_,i) => <div key={i} className="w-1 h-1 bg-gray-200 rounded-sm" />)}
            </div>
          </div>
        </div>
        {/* "campus" wordmark */}
        <span
          className="text-xl font-bold tracking-tight leading-none"
          style={{
            background: 'linear-gradient(90deg, #60b0e8 0%, #5ec9bc 60%, #c0aa94 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          campus
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-[#1a2a45]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-[#1e3052]">
        {session?.user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? ''}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {session.user.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
              <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2a45] transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

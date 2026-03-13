'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classes', label: 'Clases', icon: Dumbbell },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/reservations', label: 'Reservas', icon: ClipboardList },
  { href: '/services', label: 'Servicios', icon: Settings2 },
  { href: '/api-docs', label: 'API Docs', icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
        <CalendarDays className="h-6 w-6 text-blue-400" />
        <span className="text-white font-semibold text-base leading-tight">
          Agenda<br />
          <span className="text-blue-400 font-bold">Admin</span>
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
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">Panel Administrativo</p>
        <p className="text-xs text-gray-600">uso interno</p>
      </div>
    </aside>
  );
}

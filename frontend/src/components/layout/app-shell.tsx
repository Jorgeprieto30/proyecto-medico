'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

const AUTH_PATHS = ['/login', '/register', '/portal'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#f0f4ff]">
      <Sidebar />
      <div className="flex-1 ml-60">
        <main className="min-h-screen p-6">{children}</main>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Sidebar } from '@/components/layout/sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agenda por Cupos — Admin',
  description: 'Panel administrativo interno de agenda por cupos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <div className="flex min-h-screen bg-[#f0f4ff]">
            <Sidebar />
            <div className="flex-1 ml-60">
              <main className="min-h-screen p-6">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

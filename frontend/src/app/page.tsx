'use client';

import { useQuery } from '@tanstack/react-query';
import { servicesApi, reservationsApi, availabilityApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CheckCircle, Settings2, Users } from 'lucide-react';
import Link from 'next/link';
import { todayAsString, formatTime } from '@/lib/utils';

export default function DashboardPage() {
  const today = todayAsString();

  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const activeServices = services?.filter((s) => s.isActive) ?? [];

  // Disponibilidad de hoy para cada servicio activo
  const availabilityQueries = activeServices.slice(0, 3).map((s) => ({
    service: s,
  }));

  if (loadingServices) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Resumen del sistema de agenda por cupos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Settings2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Servicios activos</p>
                <p className="text-2xl font-bold text-gray-900">{activeServices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <CalendarDays className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Servicios totales</p>
                <p className="text-2xl font-bold text-gray-900">{services?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-100 p-3">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hoy</p>
                <p className="text-lg font-bold text-gray-900">{today}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Servicios */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Servicios configurados</CardTitle>
            <Link
              href="/services"
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todos →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!services?.length ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No hay servicios. <Link href="/services" className="text-blue-600 hover:underline">Crear el primero</Link>
            </p>
          ) : (
            <div className="divide-y">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/services/${service.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {service.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {service.timezone} · bloques de {service.slotDurationMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={service.isActive ? 'success' : 'muted'}>
                      {service.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Link
                      href={`/availability?service_id=${service.id}&date=${today}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver hoy →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/services', label: 'Gestionar servicios', color: 'blue' },
          { href: '/availability', label: 'Ver disponibilidad', color: 'green' },
          { href: '/reservations', label: 'Ver reservas', color: 'purple' },
          { href: `/reservations?date=${today}`, label: 'Reservas de hoy', color: 'orange' },
        ].map(({ href, label, color }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg border-2 border-${color}-200 bg-${color}-50 p-4 text-center text-sm font-medium text-${color}-700 hover:bg-${color}-100 transition-colors`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

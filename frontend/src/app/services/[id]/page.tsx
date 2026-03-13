'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ClipboardList } from 'lucide-react';
import { servicesApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { ScheduleRulesTab } from '@/components/services/schedule-rules-tab';
import { ScheduleBlocksTab } from '@/components/services/schedule-blocks-tab';
import { ExceptionsTab } from '@/components/services/exceptions-tab';
import { todayAsString } from '@/lib/utils';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const serviceId = Number(id);
  const today = todayAsString();

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.get(serviceId),
    enabled: !!serviceId,
  });

  if (isLoading) return <PageSpinner />;
  if (!service) return <p className="text-gray-500">Servicio no encontrado.</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/services" className="hover:text-gray-900 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Servicios
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{service.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
            <Badge variant={service.isActive ? 'success' : 'muted'}>
              {service.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          {service.description && (
            <p className="text-gray-500 mt-1">{service.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>🌍 {service.timezone}</span>
            <span>⏱ Bloques de {service.slotDurationMinutes} min</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild size="sm">
            <Link href={`/availability?service_id=${serviceId}&date=${today}`}>
              <CalendarDays className="h-4 w-4" />
              Ver disponibilidad
            </Link>
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link href={`/reservations?service_id=${serviceId}&date=${today}`}>
              <ClipboardList className="h-4 w-4" />
              Ver reservas
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="rules">
        <Tabs.List className="flex border-b gap-1">
          {[
            { value: 'rules', label: 'Horarios semanales' },
            { value: 'blocks', label: 'Capacidad por tramo' },
            { value: 'exceptions', label: 'Excepciones' },
          ].map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 border-b-2 border-transparent data-[state=active]:text-blue-600 data-[state=active]:border-blue-600 hover:text-gray-900 transition-colors"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="rules" className="pt-4">
          <ScheduleRulesTab serviceId={serviceId} />
        </Tabs.Content>

        <Tabs.Content value="blocks" className="pt-4">
          <ScheduleBlocksTab serviceId={serviceId} />
        </Tabs.Content>

        <Tabs.Content value="exceptions" className="pt-4">
          <ExceptionsTab serviceId={serviceId} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Globe } from 'lucide-react';

import { servicesApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { ScheduleRulesTab } from './schedule-rules-tab';
import { ScheduleBlocksTab } from './schedule-blocks-tab';
import { ExceptionsTab } from './exceptions-tab';

type Tab = 'rules' | 'blocks' | 'exceptions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'rules',      label: 'Horarios semanales' },
  { id: 'blocks',     label: 'Capacidad por tramo' },
  { id: 'exceptions', label: 'Excepciones' },
];

export function ServiceDetailModal({
  serviceId,
  onClose,
}: {
  serviceId: string | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('rules');

  const { data: service } = useQuery({
    queryKey: ['services', serviceId],
    queryFn: () => servicesApi.get(serviceId!),
    enabled: !!serviceId,
  });

  return (
    <Modal
      open={!!serviceId}
      onClose={onClose}
      title={service?.name ?? 'Horarios'}
      description={
        service
          ? `Gestiona los horarios y configuración del evento.`
          : undefined
      }
      className="max-w-3xl"
    >
      {service && (
        <div className="flex items-center gap-4 text-sm text-gray-500 -mt-1 mb-4 pb-4 border-b">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {service.slotDurationMinutes} min por slot
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {service.timezone}
          </span>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex border-b mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {serviceId && (
        <>
          {activeTab === 'rules'      && <ScheduleRulesTab  serviceId={serviceId} />}
          {activeTab === 'blocks'     && <ScheduleBlocksTab serviceId={serviceId} />}
          {activeTab === 'exceptions' && <ExceptionsTab     serviceId={serviceId} />}
        </>
      )}
    </Modal>
  );
}

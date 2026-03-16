'use client';

import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Endpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  requestBody?: object;
  response?: object;
  queryParams?: { name: string; type: string; required?: boolean; description?: string }[];
  pathParams?: { name: string; type: string; description?: string }[];
}

interface Section {
  title: string;
  description: string;
  baseUrl: string;
  endpoints: Endpoint[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const API_BASE = 'https://proyecto-medico-production-dc07.up.railway.app/api/v1';

const SECTIONS: Section[] = [
  {
    title: 'Servicios',
    description: 'Gestión de servicios (clases). Cada servicio define su zona horaria y duración de slot.',
    baseUrl: '/services',
    endpoints: [
      {
        method: 'GET',
        path: '/services',
        summary: 'Listar todos los servicios',
        response: [
          { id: 1, name: 'Spinning', description: null, timezone: 'America/Santiago', slotDurationMinutes: 60, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        ],
      },
      {
        method: 'POST',
        path: '/services',
        summary: 'Crear un servicio',
        requestBody: { name: 'Spinning', description: 'Clase de spinning', timezone: 'America/Santiago', slotDurationMinutes: 60 },
        response: { id: 1, name: 'Spinning', timezone: 'America/Santiago', slotDurationMinutes: 60, isActive: true },
      },
      {
        method: 'GET',
        path: '/services/:id',
        summary: 'Obtener un servicio por ID',
        pathParams: [{ name: 'id', type: 'number', description: 'ID del servicio' }],
        response: { id: 1, name: 'Spinning', timezone: 'America/Santiago', slotDurationMinutes: 60, isActive: true },
      },
      {
        method: 'PATCH',
        path: '/services/:id',
        summary: 'Actualizar un servicio',
        pathParams: [{ name: 'id', type: 'number' }],
        requestBody: { name: 'Spinning Pro', isActive: false },
        response: { id: 1, name: 'Spinning Pro', isActive: false },
      },
    ],
  },
  {
    title: 'Reglas semanales',
    description: 'Define qué días y en qué horarios un servicio está activo. Soporta rango de vigencia (validFrom/validUntil).',
    baseUrl: '/services/:serviceId/schedule-rules',
    endpoints: [
      {
        method: 'GET',
        path: '/services/:serviceId/schedule-rules',
        summary: 'Listar reglas de un servicio',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        response: [{ id: 1, serviceId: 1, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', isActive: true, validFrom: '2026-01-01', validUntil: null }],
      },
      {
        method: 'POST',
        path: '/services/:serviceId/schedule-rules',
        summary: 'Crear una regla semanal',
        description: 'dayOfWeek: 1=Lunes … 7=Domingo (ISO 8601). validFrom/validUntil son opcionales.',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        requestBody: { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', validFrom: '2026-03-01', validUntil: '2026-06-30' },
        response: { id: 1, serviceId: 1, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', validFrom: '2026-03-01', validUntil: '2026-06-30', isActive: true },
      },
      {
        method: 'PATCH',
        path: '/services/:serviceId/schedule-rules/:id',
        summary: 'Actualizar una regla',
        pathParams: [{ name: 'serviceId', type: 'number' }, { name: 'id', type: 'number' }],
        requestBody: { isActive: false },
      },
      {
        method: 'DELETE',
        path: '/services/:serviceId/schedule-rules/:id',
        summary: 'Eliminar una regla',
        pathParams: [{ name: 'serviceId', type: 'number' }, { name: 'id', type: 'number' }],
      },
    ],
  },
  {
    title: 'Bloques de capacidad',
    description: 'Configura cuántos cupos tiene cada tramo horario. Solo los slots con bloque configurado son reservables.',
    baseUrl: '/services/:serviceId/schedule-blocks',
    endpoints: [
      {
        method: 'GET',
        path: '/services/:serviceId/schedule-blocks',
        summary: 'Listar bloques de un servicio',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        response: [{ id: 1, serviceId: 1, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', capacity: 5, isActive: true }],
      },
      {
        method: 'POST',
        path: '/services/:serviceId/schedule-blocks',
        summary: 'Crear un bloque de capacidad',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        requestBody: { dayOfWeek: 1, startTime: '08:00', endTime: '09:00', capacity: 5 },
        response: { id: 1, serviceId: 1, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', capacity: 5, isActive: true },
      },
      {
        method: 'PATCH',
        path: '/services/:serviceId/schedule-blocks/:id',
        summary: 'Actualizar un bloque',
        pathParams: [{ name: 'serviceId', type: 'number' }, { name: 'id', type: 'number' }],
        requestBody: { capacity: 10 },
      },
      {
        method: 'DELETE',
        path: '/services/:serviceId/schedule-blocks/:id',
        summary: 'Eliminar un bloque',
        pathParams: [{ name: 'serviceId', type: 'number' }, { name: 'id', type: 'number' }],
      },
    ],
  },
  {
    title: 'Excepciones',
    description: 'Permite cerrar días, bloquear tramos o cambiar la capacidad en fechas específicas. Tienen prioridad sobre las reglas semanales.',
    baseUrl: '/services/:serviceId/exceptions',
    endpoints: [
      {
        method: 'GET',
        path: '/services/:serviceId/exceptions',
        summary: 'Listar excepciones de un servicio',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        response: [{ id: 1, serviceId: 1, exceptionDate: '2026-05-01', startTime: null, endTime: null, isClosed: true, capacityOverride: null, reason: 'Feriado nacional' }],
      },
      {
        method: 'POST',
        path: '/services/:serviceId/exceptions',
        summary: 'Crear una excepción',
        description: 'isClosed=true cierra el tramo. Si startTime/endTime están vacíos, aplica al día completo. Alternativa: isClosed=false + capacityOverride para cambiar capacidad.',
        pathParams: [{ name: 'serviceId', type: 'number' }],
        requestBody: { exceptionDate: '2026-05-01', isClosed: true, reason: 'Feriado nacional' },
        response: { id: 1, serviceId: 1, exceptionDate: '2026-05-01', isClosed: true, reason: 'Feriado nacional' },
      },
      {
        method: 'PATCH',
        path: '/exceptions/:id',
        summary: 'Actualizar una excepción',
        pathParams: [{ name: 'id', type: 'number' }],
        requestBody: { reason: 'Actualizado' },
      },
      {
        method: 'DELETE',
        path: '/exceptions/:id',
        summary: 'Eliminar una excepción',
        pathParams: [{ name: 'id', type: 'number' }],
      },
    ],
  },
  {
    title: 'Disponibilidad',
    description: 'Consulta los cupos disponibles. Los slots se generan dinámicamente (no se persisten en BD) a partir de reglas + bloques + excepciones.',
    baseUrl: '/availability',
    endpoints: [
      {
        method: 'GET',
        path: '/availability',
        summary: 'Disponibilidad por fecha',
        description: 'Retorna todos los slots del día con su ocupación. Los slots sin bloque configurado no aparecen.',
        queryParams: [
          { name: 'service_id', type: 'number', required: true, description: 'ID del servicio' },
          { name: 'date', type: 'string', required: true, description: 'Fecha en formato YYYY-MM-DD' },
        ],
        response: [
          { slot_start: '2026-03-13T11:00:00.000Z', slot_end: '2026-03-13T12:00:00.000Z', capacity: 5, reserved: 2, available: 3, bookable: true },
        ],
      },
      {
        method: 'GET',
        path: '/availability/slot',
        summary: 'Disponibilidad de un slot específico',
        queryParams: [
          { name: 'service_id', type: 'number', required: true },
          { name: 'datetime', type: 'string', required: true, description: 'ISO 8601 con timezone, ej: 2026-03-13T08:00:00-04:00' },
        ],
        response: { slot_start: '2026-03-13T11:00:00.000Z', slot_end: '2026-03-13T12:00:00.000Z', capacity: 5, reserved: 2, available: 3, bookable: true, exists: true },
      },
    ],
  },
  {
    title: 'Reservas',
    description: 'Gestión de reservas. Usa pg_advisory_xact_lock para evitar sobre-reservas concurrentes. Retorna 409 si no hay cupos.',
    baseUrl: '/reservations',
    endpoints: [
      {
        method: 'GET',
        path: '/reservations',
        summary: 'Listar reservas',
        queryParams: [
          { name: 'service_id', type: 'number', required: true },
          { name: 'date', type: 'string', required: false, description: 'Filtrar por fecha YYYY-MM-DD' },
          { name: 'status', type: 'enum', required: false, description: 'confirmed | pending | cancelled' },
        ],
        response: [{ id: 1, serviceId: 1, slotStart: '2026-03-13T11:00:00Z', slotEnd: '2026-03-13T12:00:00Z', status: 'confirmed', customerName: 'Juan Pérez', customerExternalId: '12.345.678-9' }],
      },
      {
        method: 'POST',
        path: '/reservations',
        summary: 'Crear una reserva',
        description: 'Valida que el slot exista y tenga cupos. Usa advisory lock por (service_id, slot_start) para evitar concurrencia. Retorna 409 si no hay cupos.',
        requestBody: { service_id: 1, slot_start: '2026-03-13T11:00:00-04:00', customer_name: 'Juan Pérez', customer_external_id: '12.345.678-9' },
        response: { id: 1, serviceId: 1, slotStart: '2026-03-13T11:00:00Z', status: 'confirmed', customerName: 'Juan Pérez' },
      },
      {
        method: 'GET',
        path: '/reservations/:id',
        summary: 'Detalle de una reserva',
        pathParams: [{ name: 'id', type: 'number' }],
        response: { id: 1, serviceId: 1, slotStart: '2026-03-13T11:00:00Z', status: 'confirmed' },
      },
      {
        method: 'PATCH',
        path: '/reservations/:id/cancel',
        summary: 'Cancelar una reserva',
        description: 'Cambia el status a "cancelled". Libera el cupo automáticamente.',
        pathParams: [{ name: 'id', type: 'number' }],
        response: { id: 1, status: 'cancelled' },
      },
    ],
  },
];

// ─── Method Badge ─────────────────────────────────────────────────────────────

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET:    'bg-blue-100 text-blue-700 font-bold',
  POST:   'bg-green-100 text-green-700 font-bold',
  PATCH:  'bg-yellow-100 text-yellow-700 font-bold',
  DELETE: 'bg-red-100 text-red-700 font-bold',
};

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded font-mono ${METHOD_STYLES[method]}`}>
      {method}
    </span>
  );
}

// ─── Endpoint Item ────────────────────────────────────────────────────────────

function EndpointItem({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-sm text-gray-800">{endpoint.path}</span>
        <span className="text-sm text-gray-500 ml-2 flex-1">{endpoint.summary}</span>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-white">
          {endpoint.description && (
            <p className="text-sm text-gray-600">{endpoint.description}</p>
          )}

          {endpoint.pathParams && (
            <ParamTable title="Path params" params={endpoint.pathParams.map((p) => ({ ...p, required: true }))} />
          )}

          {endpoint.queryParams && (
            <ParamTable title="Query params" params={endpoint.queryParams} />
          )}

          {endpoint.requestBody && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Request body (JSON)</p>
              <pre className="bg-gray-950 text-green-300 rounded-lg p-3 text-xs overflow-x-auto">
                {JSON.stringify(endpoint.requestBody, null, 2)}
              </pre>
            </div>
          )}

          {endpoint.response && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Response 200/201</p>
              <pre className="bg-gray-950 text-blue-300 rounded-lg p-3 text-xs overflow-x-auto">
                {JSON.stringify(endpoint.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamTable({ title, params }: {
  title: string;
  params: { name: string; type: string; required?: boolean; description?: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{title}</p>
      <table className="w-full text-sm border rounded-lg overflow-hidden">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Requerido</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Descripción</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="px-3 py-2 font-mono text-xs text-gray-800">{p.name}</td>
              <td className="px-3 py-2 text-xs text-purple-700">{p.type}</td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-xs text-green-700 font-medium">Sí</span>
                ) : (
                  <span className="text-xs text-gray-400">No</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{p.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function ApiSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 text-left hover:bg-gray-100 transition-colors"
      >
        <div>
          <h2 className="font-semibold text-gray-900">{section.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-400">{section.endpoints.length} endpoints</span>
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-6 py-4 space-y-2 bg-white">
          {section.endpoints.map((ep, i) => (
            <EndpointItem key={i} endpoint={ep} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentación de API</h1>
          <p className="text-gray-500 text-sm mt-1">
            REST API del sistema de agenda por cupos.
            Base URL: <span className="font-mono text-blue-600">{API_BASE}</span>
          </p>
        </div>
        <a
          href="https://proyecto-medico-production-dc07.up.railway.app/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Swagger UI
        </a>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Respuestas', value: 'Wrapeadas en { data }' },
          { label: 'Errores', value: '{ statusCode, error, message }' },
          { label: 'Fechas', value: 'UTC (timestamptz)' },
          { label: 'Auth', value: 'X-Api-Key requerida' },
        ].map((item) => (
          <div key={item.label} className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Auth section */}
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-semibold text-sm uppercase tracking-wide">🔑 Autenticación</span>
        </div>
        <p className="text-sm text-amber-900">
          Todos los endpoints requieren autenticación. Genera tu API key en{' '}
          <strong>Configuración → API Keys</strong> del panel admin. Cada clave identifica tu plataforma o integración.
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-1.5">Opción 1 — Header X-Api-Key (recomendado para integraciones)</p>
            <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto">{`curl ${API_BASE}/services \\
  -H "X-Api-Key: ak_tu_clave_aqui"`}</pre>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-1.5">Opción 2 — Bearer token (también válido)</p>
            <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto">{`curl ${API_BASE}/services \\
  -H "Authorization: Bearer ak_tu_clave_aqui"`}</pre>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            { code: '401', desc: 'Sin clave o clave inválida' },
            { code: '403', desc: 'Clave revocada' },
            { code: '200', desc: 'Autenticado correctamente' },
          ].map((r) => (
            <div key={r.code} className="bg-white border border-amber-100 rounded-lg px-3 py-2">
              <span className="font-mono text-xs font-bold text-amber-700">{r.code}</span>
              <p className="text-xs text-gray-600 mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 space-y-1">
        <p><strong>Respuesta estándar:</strong> todas las respuestas exitosas están envueltas en <code className="bg-blue-100 px-1 rounded">{'{ "data": ..., "timestamp": "..." }'}</code></p>
        <p><strong>Errores:</strong> retornan <code className="bg-blue-100 px-1 rounded">{'{ "statusCode": 409, "error": "Conflict", "message": "Sin cupos disponibles" }'}</code></p>
        <p><strong>Timezones:</strong> los slots en disponibilidad se devuelven en UTC. Los horarios de reglas y bloques son locales al servicio.</p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <ApiSection key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

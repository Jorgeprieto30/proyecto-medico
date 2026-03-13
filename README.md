# Agenda por Cupos — Backend

Backend de agenda por cupos construido con **NestJS + TypeORM + PostgreSQL**.

> No es una agenda de eventos individuales. Cada bloque horario tiene una **capacidad máxima de cupos** configurable. El sistema gestiona disponibilidad, excepciones y reservas concurrentes de forma segura.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | NestJS 10 |
| ORM | TypeORM 0.3 |
| Base de datos | PostgreSQL 16 |
| Timezone | Luxon 3 |
| Documentación | Swagger / OpenAPI 3 |
| Validación | class-validator + class-transformer |

---

## Requisitos previos

- Node.js 18+
- Docker y Docker Compose (para PostgreSQL local)
- npm o yarn

---

## Instalación y puesta en marcha

### 1. Clonar e instalar dependencias

```bash
cd proyecto_medico
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env si es necesario (credenciales de BD, puerto, etc.)
```

### 3. Levantar PostgreSQL con Docker

```bash
docker-compose up -d
# Verificar que esté corriendo:
docker-compose ps
```

### 4. Ejecutar migraciones

```bash
npm run migration:run
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con hot reload)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

### URLs disponibles

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000/api/v1` | API REST |
| `http://localhost:3000/api/docs` | Documentación Swagger |

---

## Estructura del proyecto

```
src/
├── main.ts                          # Bootstrap de la aplicación
├── app.module.ts                    # Módulo raíz
├── data-source.ts                   # DataSource para CLI de TypeORM
├── database/
│   └── database.module.ts           # Configuración de TypeORM
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts # Manejo global de errores
│   └── interceptors/
│       └── transform.interceptor.ts # Respuestas consistentes
├── migrations/
│   └── 1710000000000-InitialSchema  # Migración inicial
└── modules/
    ├── services/                    # CRUD de servicios
    ├── schedule-rules/              # Reglas semanales de horario
    ├── schedule-blocks/             # Bloques con capacidad por tramo
    ├── exceptions/                  # Excepciones por fecha
    ├── availability/                # Consulta de disponibilidad
    └── reservations/                # Gestión de reservas
```

---

## Modelo de datos

```
services
  id, name, description, timezone, slot_duration_minutes, is_active

service_schedule_rules
  id, service_id, day_of_week (1=Lun, 7=Dom), start_time, end_time, is_active

service_schedule_blocks
  id, service_id, day_of_week, start_time, end_time, capacity, is_active

service_exceptions
  id, service_id, exception_date, start_time?, end_time?, is_closed, capacity_override?, reason?

reservations
  id, service_id, slot_start (UTC), slot_end (UTC), status, customer_name?,
  customer_external_id?, metadata?, created_at, updated_at
```

---

## API Reference

### Servicios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/services` | Crear servicio |
| `GET` | `/api/v1/services` | Listar servicios |
| `GET` | `/api/v1/services/:id` | Detalle de servicio |
| `PATCH` | `/api/v1/services/:id` | Actualizar servicio |

### Reglas semanales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/services/:id/schedule-rules` | Crear regla semanal |
| `GET` | `/api/v1/services/:id/schedule-rules` | Listar reglas |
| `PATCH` | `/api/v1/schedule-rules/:ruleId` | Actualizar regla |
| `DELETE` | `/api/v1/schedule-rules/:ruleId` | Desactivar regla |

### Bloques con capacidad

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/services/:id/schedule-blocks` | Crear tramo con capacidad |
| `GET` | `/api/v1/services/:id/schedule-blocks` | Listar tramos |
| `PATCH` | `/api/v1/schedule-blocks/:blockId` | Actualizar tramo |
| `DELETE` | `/api/v1/schedule-blocks/:blockId` | Desactivar tramo |

### Excepciones por fecha

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/services/:id/exceptions` | Crear excepción |
| `GET` | `/api/v1/services/:id/exceptions` | Listar excepciones |
| `PATCH` | `/api/v1/exceptions/:exceptionId` | Actualizar excepción |
| `DELETE` | `/api/v1/exceptions/:exceptionId` | Eliminar excepción |

### Disponibilidad

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/availability?service_id=1&date=2026-03-20` | Disponibilidad del día |
| `GET` | `/api/v1/availability/slot?service_id=1&datetime=2026-03-20T09:00:00-03:00` | Disponibilidad de un slot |

### Reservas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/reservations` | Reservar cupo |
| `GET` | `/api/v1/reservations?service_id=1&date=2026-03-20` | Listar reservas |
| `GET` | `/api/v1/reservations/:id` | Detalle de reserva |
| `PATCH` | `/api/v1/reservations/:id/cancel` | Cancelar reserva |

---

## Ejemplo de uso completo

### 1. Crear servicio

```bash
curl -X POST http://localhost:3000/api/v1/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Consulta Médica",
    "description": "Consulta médica general",
    "timezone": "America/Santiago",
    "slotDurationMinutes": 60,
    "isActive": true
  }'
```

### 2. Configurar reglas semanales (Lunes a Viernes)

```bash
# Lunes (dayOfWeek=1)
curl -X POST http://localhost:3000/api/v1/services/1/schedule-rules \
  -H "Content-Type: application/json" \
  -d '{"dayOfWeek": 1, "startTime": "08:00", "endTime": "20:00"}'

# Repetir para martes=2, miércoles=3, jueves=4, viernes=5
```

### 3. Configurar bloques con capacidad

```bash
# Lunes 08:00-09:00 → 5 cupos
curl -X POST http://localhost:3000/api/v1/services/1/schedule-blocks \
  -H "Content-Type: application/json" \
  -d '{"dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "capacity": 5}'

# Lunes 09:00-10:00 → 3 cupos
curl -X POST http://localhost:3000/api/v1/services/1/schedule-blocks \
  -H "Content-Type: application/json" \
  -d '{"dayOfWeek": 1, "startTime": "09:00", "endTime": "10:00", "capacity": 3}'
```

### 4. Agregar excepción (feriado cerrado)

```bash
curl -X POST http://localhost:3000/api/v1/services/1/exceptions \
  -H "Content-Type: application/json" \
  -d '{
    "exceptionDate": "2026-03-20",
    "isClosed": true,
    "reason": "Feriado nacional"
  }'
```

### 5. Consultar disponibilidad

```bash
curl "http://localhost:3000/api/v1/availability?service_id=1&date=2026-03-21"
```

Respuesta:
```json
{
  "data": [
    {
      "slot_start": "2026-03-21T08:00:00-03:00",
      "slot_end": "2026-03-21T09:00:00-03:00",
      "capacity": 5,
      "reserved": 2,
      "available": 3,
      "bookable": true
    },
    {
      "slot_start": "2026-03-21T09:00:00-03:00",
      "slot_end": "2026-03-21T10:00:00-03:00",
      "capacity": 3,
      "reserved": 3,
      "available": 0,
      "bookable": false
    }
  ],
  "timestamp": "2026-03-12T10:00:00.000Z"
}
```

### 6. Reservar un cupo

```bash
curl -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "slot_start": "2026-03-21T08:00:00-03:00",
    "customer_name": "Jorge Prieto",
    "customer_external_id": "client_123",
    "metadata": {"source": "internal"}
  }'
```

---

## Concurrencia y seguridad

La creación de reservas usa **`pg_advisory_xact_lock`** de PostgreSQL para garantizar que dos peticiones simultáneas para el mismo bloque no puedan crear una sobre-reserva.

Flujo de la reserva segura:
1. Validar que el slot existe y está habilitado
2. Iniciar transacción
3. Adquirir lock advisory basado en `(service_id, slot_start)` — serializa acceso concurrente al bloque
4. Contar reservas activas (`confirmed` + `pending`) del bloque
5. Si `disponibles > 0` → crear reserva con estado `confirmed`
6. Si `disponibles <= 0` → error `409 Conflict`
7. Confirmar transacción (libera lock)

---

## Reglas de negocio

| Regla | Descripción |
|-------|-------------|
| Disponibilidad | `cupos_disponibles = capacity - reservas_activas` |
| Estados activos | `confirmed` y `pending` consumen cupo |
| Cancelación | `cancelled` libera el cupo |
| Excepciones | Siempre pisan la configuración semanal |
| Slots sin bloque | No tienen capacidad → no son reservables |
| Día de semana | ISO 8601: 1=Lunes, 7=Domingo |
| Timezones | Todos los datetimes se almacenan en UTC en la BD |

---

## Errores HTTP

| Código | Significado |
|--------|-------------|
| `400` | Input inválido (formato, rango, etc.) |
| `404` | Recurso no encontrado |
| `409` | Sin cupos disponibles |
| `500` | Error interno del servidor |

---

## Comandos útiles

```bash
# Ver migraciones pendientes
npm run migration:show

# Revertir última migración
npm run migration:revert

# Logs de la BD
docker-compose logs postgres

# Conectarse a PostgreSQL
docker exec -it agenda_cupos_db psql -U agenda_user -d agenda_cupos
```

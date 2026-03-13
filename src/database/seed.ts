/**
 * Script de seed: crea la clase de Spinning como ejemplo.
 *
 * Uso: npx ts-node -r tsconfig-paths/register src/database/seed.ts
 */

const API = 'http://localhost:3000/api/v1';

async function post(path: string, body: object) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${err}`);
  }
  const { data } = await res.json();
  return data;
}

async function seed() {
  console.log('🌱 Iniciando seed...');

  // 1. Crear servicio
  const svc = await post('/services', {
    name: 'Spinning',
    description: 'Clase de spinning de alta intensidad en bicicleta estática',
    timezone: 'America/Santiago',
    slotDurationMinutes: 60,
  });
  console.log(`✅ Servicio creado: ID=${svc.id} "${svc.name}"`);

  // 2. Crear reglas semanales: Lunes (1), Miércoles (3), Viernes (5)
  for (const day of [1, 3, 5]) {
    await post(`/services/${svc.id}/schedule-rules`, {
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '09:00',
      validFrom: '2026-01-01',
    });
    console.log(`  📅 Regla creada: día ${day} 08:00–09:00`);
  }

  // 3. Crear bloques de capacidad: mismos días, 5 cupos cada uno
  for (const day of [1, 3, 5]) {
    await post(`/services/${svc.id}/schedule-blocks`, {
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '09:00',
      capacity: 5,
    });
    console.log(`  🏋️  Bloque creado: día ${day} 08:00–09:00, 5 cupos`);
  }

  console.log('\n🎉 Seed completado. Clase "Spinning" lista con 5 cupos los Lunes, Miércoles y Viernes de 8–9am.');
  console.log(`   Servicio ID: ${svc.id}`);
  console.log(`   Frontend: http://localhost:3001/classes`);
  console.log(`   Calendario: http://localhost:3001/calendar`);
}

seed().catch((e) => {
  console.error('❌ Error en seed:', e.message);
  process.exit(1);
});

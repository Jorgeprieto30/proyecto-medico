import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial: crea todas las tablas del sistema de agenda por cupos.
 *
 * Tablas:
 *   - services
 *   - service_schedule_rules
 *   - service_schedule_blocks
 *   - service_exceptions
 *   - reservations
 */
export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Tabla: services
    // =========================================================================
    await queryRunner.query(`
      CREATE TABLE "services" (
        "id"                     SERIAL PRIMARY KEY,
        "name"                   VARCHAR(255) NOT NULL,
        "description"            TEXT,
        "timezone"               VARCHAR(100) NOT NULL DEFAULT 'UTC',
        "slot_duration_minutes"  INTEGER NOT NULL DEFAULT 60,
        "is_active"              BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "services" IS 'Servicios configurables con su zona horaria y duración de bloque';
    `);

    // =========================================================================
    // Tabla: service_schedule_rules
    // Define la disponibilidad semanal del servicio (día + horario de inicio/fin)
    // =========================================================================
    await queryRunner.query(`
      CREATE TABLE "service_schedule_rules" (
        "id"           SERIAL PRIMARY KEY,
        "service_id"   INTEGER NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
        "day_of_week"  SMALLINT NOT NULL CHECK ("day_of_week" BETWEEN 1 AND 7),
        "start_time"   TIME NOT NULL,
        "end_time"     TIME NOT NULL,
        "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_schedule_rule_times" CHECK ("start_time" < "end_time")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_schedule_rules_service_day"
        ON "service_schedule_rules" ("service_id", "day_of_week");
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "service_schedule_rules" IS
        'Reglas semanales de horario. day_of_week: 1=Lunes, 7=Domingo (ISO 8601)';
    `);

    // =========================================================================
    // Tabla: service_schedule_blocks
    // Define la capacidad (cupos) por tramo horario dentro de un día de semana
    // =========================================================================
    await queryRunner.query(`
      CREATE TABLE "service_schedule_blocks" (
        "id"           SERIAL PRIMARY KEY,
        "service_id"   INTEGER NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
        "day_of_week"  SMALLINT NOT NULL CHECK ("day_of_week" BETWEEN 1 AND 7),
        "start_time"   TIME NOT NULL,
        "end_time"     TIME NOT NULL,
        "capacity"     INTEGER NOT NULL DEFAULT 1 CHECK ("capacity" >= 1),
        "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_schedule_block_times" CHECK ("start_time" < "end_time")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_schedule_blocks_service_day"
        ON "service_schedule_blocks" ("service_id", "day_of_week");
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "service_schedule_blocks" IS 'Capacidad por tramo horario. Un slot es valido solo si cae dentro de un bloque activo.';
    `);

    // =========================================================================
    // Tabla: service_exceptions
    // Excepciones por fecha que pisan la configuración semanal
    // =========================================================================
    await queryRunner.query(`
      CREATE TABLE "service_exceptions" (
        "id"                SERIAL PRIMARY KEY,
        "service_id"        INTEGER NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
        "exception_date"    DATE NOT NULL,
        "start_time"        TIME,
        "end_time"          TIME,
        "is_closed"         BOOLEAN NOT NULL DEFAULT FALSE,
        "capacity_override" INTEGER CHECK ("capacity_override" >= 0),
        "reason"            TEXT,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_service_exceptions_service_date"
        ON "service_exceptions" ("service_id", "exception_date");
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "service_exceptions" IS 'Excepciones por fecha. Prioridad sobre reglas semanales. is_closed=true cierra el dia. capacity_override cambia la capacidad de un tramo.';
    `);

    // =========================================================================
    // Tabla: reservations
    // =========================================================================
    await queryRunner.query(`
      CREATE TYPE "reservation_status_enum" AS ENUM ('confirmed', 'pending', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id"                    SERIAL PRIMARY KEY,
        "service_id"            INTEGER NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
        "slot_start"            TIMESTAMPTZ NOT NULL,
        "slot_end"              TIMESTAMPTZ NOT NULL,
        "status"                "reservation_status_enum" NOT NULL DEFAULT 'confirmed',
        "customer_name"         VARCHAR(255),
        "customer_external_id"  VARCHAR(255),
        "metadata"              JSONB,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_reservation_times" CHECK ("slot_start" < "slot_end")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reservations_service_slot_start"
        ON "reservations" ("service_id", "slot_start");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reservations_service_slot_status"
        ON "reservations" ("service_id", "slot_start", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reservations_customer_external_id"
        ON "reservations" ("customer_external_id")
        WHERE "customer_external_id" IS NOT NULL;
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "reservations" IS 'Reservas de cupos. confirmed y pending consumen cupo. cancelled libera el cupo. slot_start y slot_end en UTC.';
    `);

    // =========================================================================
    // Función de trigger: actualiza updated_at automáticamente
    // =========================================================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const tables = [
      'services',
      'service_schedule_rules',
      'service_schedule_blocks',
      'service_exceptions',
      'reservations',
    ];

    for (const table of tables) {
      await queryRunner.query(`
        CREATE TRIGGER "trg_${table}_updated_at"
          BEFORE UPDATE ON "${table}"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'services',
      'service_schedule_rules',
      'service_schedule_blocks',
      'service_exceptions',
      'reservations',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_${table}_updated_at" ON "${table}";`);
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reservation_status_enum";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_exceptions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_schedule_blocks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_schedule_rules";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "services";`);
  }
}

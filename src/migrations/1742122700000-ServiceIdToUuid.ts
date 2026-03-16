import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cambia services.id de SERIAL INTEGER a UUID.
 * También actualiza las FK (service_id) en todas las tablas hijas.
 */
export class ServiceIdToUuid1742122700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. Añadir columna uuid temporal en services
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN "new_uuid_id" UUID DEFAULT uuid_generate_v4() NOT NULL`,
    );

    // 2. Añadir columnas uuid temporales en tablas hijas
    for (const table of ['service_schedule_rules', 'service_schedule_blocks', 'service_exceptions', 'reservations']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "new_service_uuid" UUID`,
      );
      await queryRunner.query(
        `UPDATE "${table}" t SET "new_service_uuid" = s."new_uuid_id"
         FROM "services" s WHERE t."service_id" = s."id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "new_service_uuid" SET NOT NULL`,
      );
    }

    // 3. Eliminar FK constraints de las tablas hijas
    await queryRunner.query(`ALTER TABLE "service_schedule_rules" DROP CONSTRAINT IF EXISTS "service_schedule_rules_service_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "service_schedule_blocks" DROP CONSTRAINT IF EXISTS "service_schedule_blocks_service_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "service_exceptions"      DROP CONSTRAINT IF EXISTS "service_exceptions_service_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "reservations"            DROP CONSTRAINT IF EXISTS "reservations_service_id_fkey"`);

    // 4. Eliminar PK antigua de services y la columna id integer
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "services_pkey"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "services" RENAME COLUMN "new_uuid_id" TO "id"`);
    await queryRunner.query(`ALTER TABLE "services" ADD PRIMARY KEY ("id")`);

    // 5. Reemplazar service_id en tablas hijas
    for (const table of ['service_schedule_rules', 'service_schedule_blocks', 'service_exceptions', 'reservations']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "service_id"`);
      await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN "new_service_uuid" TO "service_id"`);
    }

    // 6. Recrear FK constraints
    await queryRunner.query(`ALTER TABLE "service_schedule_rules" ADD CONSTRAINT "fk_ssr_service"    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "service_schedule_blocks" ADD CONSTRAINT "fk_ssb_service"   FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "service_exceptions"      ADD CONSTRAINT "fk_se_service"    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "reservations"            ADD CONSTRAINT "fk_res_service"   FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE`);

    // 7. Recrear índices
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_schedule_rules_service_day"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_schedule_blocks_service_day"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_service_exceptions_service_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reservations_service_slot_start"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reservations_service_slot_status"`);

    await queryRunner.query(`CREATE INDEX "idx_schedule_rules_service_day"      ON "service_schedule_rules"  ("service_id", "day_of_week")`);
    await queryRunner.query(`CREATE INDEX "idx_schedule_blocks_service_day"     ON "service_schedule_blocks" ("service_id", "day_of_week")`);
    await queryRunner.query(`CREATE INDEX "idx_service_exceptions_service_date" ON "service_exceptions"      ("service_id", "exception_date")`);
    await queryRunner.query(`CREATE INDEX "idx_reservations_service_slot_start" ON "reservations"            ("service_id", "slot_start")`);
    await queryRunner.query(`CREATE INDEX "idx_reservations_service_slot_status" ON "reservations"           ("service_id", "slot_start", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down no restaura datos — solo estructura
    await queryRunner.query(`ALTER TABLE "service_schedule_rules"  DROP CONSTRAINT IF EXISTS "fk_ssr_service"`);
    await queryRunner.query(`ALTER TABLE "service_schedule_blocks" DROP CONSTRAINT IF EXISTS "fk_ssb_service"`);
    await queryRunner.query(`ALTER TABLE "service_exceptions"      DROP CONSTRAINT IF EXISTS "fk_se_service"`);
    await queryRunner.query(`ALTER TABLE "reservations"            DROP CONSTRAINT IF EXISTS "fk_res_service"`);

    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "services_pkey"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "services" ADD COLUMN "id" SERIAL PRIMARY KEY`);

    for (const table of ['service_schedule_rules', 'service_schedule_blocks', 'service_exceptions', 'reservations']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "service_id"`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "service_id" INTEGER NOT NULL REFERENCES "services"("id") ON DELETE CASCADE`);
    }
  }
}

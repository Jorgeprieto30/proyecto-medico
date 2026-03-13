import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega columnas valid_from y valid_until a service_schedule_rules.
 * Permite configurar un rango de fechas de vigencia para cada regla semanal.
 */
export class AddScheduleRuleValidDates1710000000001 implements MigrationInterface {
  name = 'AddScheduleRuleValidDates1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_schedule_rules"
        ADD COLUMN "valid_from"  DATE,
        ADD COLUMN "valid_until" DATE;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "service_schedule_rules"."valid_from"  IS 'Fecha de inicio de vigencia de la regla (null = sin límite)';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "service_schedule_rules"."valid_until" IS 'Fecha de fin de vigencia de la regla (null = sin límite)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_schedule_rules"
        DROP COLUMN IF EXISTS "valid_from",
        DROP COLUMN IF EXISTS "valid_until";
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRuts1743400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove dots (e.g. "12.345.678-9" → "12345678-9")
    await queryRunner.query(`
      UPDATE "members"
      SET "rut" = REPLACE("rut", '.', '')
      WHERE "rut" IS NOT NULL AND "rut" LIKE '%.%'
    `);

    // 2. Add dash before last character for RUTs that don't have one
    //    (e.g. "123456789" → "12345678-9")
    await queryRunner.query(`
      UPDATE "members"
      SET "rut" = LEFT("rut", LENGTH("rut") - 1) || '-' || RIGHT("rut", 1)
      WHERE "rut" IS NOT NULL AND "rut" NOT LIKE '%-%'
    `);

    // 3. Uppercase the verification digit (in case any are stored lowercase)
    await queryRunner.query(`
      UPDATE "members"
      SET "rut" = UPPER("rut")
      WHERE "rut" IS NOT NULL AND "rut" != UPPER("rut")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversing normalization is not feasible — this migration is intentionally one-way
  }
}

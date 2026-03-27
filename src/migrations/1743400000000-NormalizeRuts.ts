import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRuts1743400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove dots from RUTs that have them (e.g. "12.345.678-9" → "12345678-9")
    await queryRunner.query(`
      UPDATE "members"
      SET "rut" = REPLACE("rut", '.', '')
      WHERE "rut" IS NOT NULL AND "rut" LIKE '%.%'
    `);

    // Uppercase the verification digit (in case any are stored lowercase)
    await queryRunner.query(`
      UPDATE "members"
      SET "rut" = UPPER("rut")
      WHERE "rut" IS NOT NULL AND "rut" != UPPER("rut")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversing dot removal is not feasible — this migration is intentionally one-way
  }
}

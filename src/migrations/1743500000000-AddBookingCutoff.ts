import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCutoff1743500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        ADD COLUMN IF NOT EXISTS "booking_cutoff_mode" VARCHAR(20) NOT NULL DEFAULT 'hours',
        ADD COLUMN IF NOT EXISTS "booking_cutoff_hours" INT NOT NULL DEFAULT 24
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        DROP COLUMN IF EXISTS "booking_cutoff_mode",
        DROP COLUMN IF EXISTS "booking_cutoff_hours"
    `);
  }
}

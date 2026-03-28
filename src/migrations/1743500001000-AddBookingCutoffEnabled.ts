import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCutoffEnabled1743500001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        ADD COLUMN IF NOT EXISTS "booking_cutoff_enabled" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        DROP COLUMN IF EXISTS "booking_cutoff_enabled"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCutoffDays1743500002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        ADD COLUMN IF NOT EXISTS "booking_cutoff_days" INT NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        DROP COLUMN IF EXISTS "booking_cutoff_days"
    `);
  }
}

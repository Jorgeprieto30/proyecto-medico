import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokens1743300000000 implements MigrationInterface {
  name = 'AddPasswordResetTokens1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_token" VARCHAR(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMPTZ NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_reset_token" ON "users" ("reset_password_token") WHERE "reset_password_token" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "reset_password_token" VARCHAR(64) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMPTZ NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_members_reset_token" ON "members" ("reset_password_token") WHERE "reset_password_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_members_reset_token"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN IF EXISTS "reset_password_expires"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN IF EXISTS "reset_password_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_reset_token"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_expires"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_token"`);
  }
}

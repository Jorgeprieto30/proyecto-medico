import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds:
 * - center_name, center_code to users table
 * - members table
 * - member_id FK to reservations table
 */
export class AddMembersAndCenterFields1742200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add center_name and center_code to users
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "center_name" VARCHAR(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "center_code" VARCHAR(100) NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_center_code" ON "users" ("center_code") WHERE "center_code" IS NOT NULL`,
    );

    // 2. Create members table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "members" (
        "id"            UUID NOT NULL DEFAULT uuid_generate_v4(),
        "first_name"    VARCHAR(255) NOT NULL,
        "last_name"     VARCHAR(255) NOT NULL,
        "email"         VARCHAR(255) NOT NULL,
        "rut"           VARCHAR(20)  NULL,
        "password_hash" VARCHAR(255) NULL,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "members_pkey"        PRIMARY KEY ("id"),
        CONSTRAINT "members_email_unique" UNIQUE ("email")
      )
    `);

    // 3. Add member_id FK to reservations
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "member_id" UUID NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations_member"
       FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reservations_member_id" ON "reservations" ("member_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "fk_reservations_member"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reservations_member_id"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "member_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "members"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_center_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "center_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "center_name"`);
  }
}

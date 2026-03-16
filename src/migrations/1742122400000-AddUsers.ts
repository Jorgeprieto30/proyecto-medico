import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsers1742122400000 implements MigrationInterface {
  name = 'AddUsers1742122400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"         VARCHAR      NOT NULL,
        "email"        VARCHAR      NOT NULL,
        "password_hash" VARCHAR,
        "google_id"    VARCHAR,
        "avatar_url"   VARCHAR,
        "role"         VARCHAR      NOT NULL DEFAULT 'admin',
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}

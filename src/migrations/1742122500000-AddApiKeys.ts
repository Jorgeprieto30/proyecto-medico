import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeys1742122500000 implements MigrationInterface {
  name = 'AddApiKeys1742122500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"         VARCHAR      NOT NULL,
        "prefix"       VARCHAR      NOT NULL,
        "key_hash"     VARCHAR      NOT NULL,
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMPTZ,
        "user_id"      UUID         NOT NULL,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_keys"  PRIMARY KEY ("id"),
        CONSTRAINT "UQ_api_keys_hash" UNIQUE ("key_hash"),
        CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveApiKeyValue1743200000000 implements MigrationInterface {
  name = 'RemoveApiKeyValue1743200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "key_value"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_value" varchar`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberBirthDate1743100000000 implements MigrationInterface {
  name = 'AddMemberBirthDate1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "birth_date" date NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN IF EXISTS "birth_date"`);
  }
}

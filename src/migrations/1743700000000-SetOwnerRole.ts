import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetOwnerRole1743700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET role = 'owner' WHERE email = 'jprietoleighton@gmail.com'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET role = 'admin' WHERE email = 'jprietoleighton@gmail.com'
    `);
  }
}

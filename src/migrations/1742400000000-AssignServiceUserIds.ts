import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignServiceUserIds1742400000000 implements MigrationInterface {
  name = 'AssignServiceUserIds1742400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Assign services with no user_id to the oldest admin user
    await queryRunner.query(`
      UPDATE services
      SET user_id = (
        SELECT id FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
        LIMIT 1
      )
      WHERE user_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No revert — setting back to NULL would break things
  }
}

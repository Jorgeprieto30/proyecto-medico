import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReassignServicesToCenterAdmin1742400001000 implements MigrationInterface {
  name = 'ReassignServicesToCenterAdmin1742400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reassign ALL services (including those wrongly assigned) to the user
    // who has a center_code set — that's the real admin who owns the center.
    // If multiple admins have center_codes, each gets their own services via
    // the next step (re-null then re-assign). For now, assign all to the
    // admin with the oldest account that has a center_code.
    await queryRunner.query(`
      UPDATE services
      SET user_id = (
        SELECT id FROM users
        WHERE center_code IS NOT NULL
        ORDER BY created_at ASC
        LIMIT 1
      )
      WHERE user_id IS NULL
         OR user_id NOT IN (SELECT id FROM users WHERE center_code IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No revert
  }
}

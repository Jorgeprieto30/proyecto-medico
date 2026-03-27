import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearAllData1743000000000 implements MigrationInterface {
  name = 'ClearAllData1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Delete all members (clients)
    await queryRunner.query(`DELETE FROM members`);

    // Delete all users (admins) — cascades to:
    //   services → schedule_rules, schedule_blocks, service_exceptions,
    //              reservations, session_spot_overrides, api_keys
    await queryRunner.query(`DELETE FROM users`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No revert — data deletion is irreversible
  }
}

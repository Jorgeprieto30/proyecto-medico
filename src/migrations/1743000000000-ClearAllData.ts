import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearAllData1743000000000 implements MigrationInterface {
  name = 'ClearAllData1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Delete in dependency order to avoid FK violations

    // 1. Reservations reference services
    await queryRunner.query(`DELETE FROM reservations`);

    // 2. Schedule rules, blocks, exceptions and session overrides reference services
    await queryRunner.query(`DELETE FROM service_schedule_rules`);
    await queryRunner.query(`DELETE FROM service_schedule_blocks`);
    await queryRunner.query(`DELETE FROM service_exceptions`);
    await queryRunner.query(`DELETE FROM session_spot_overrides`);

    // 3. API keys reference users
    await queryRunner.query(`DELETE FROM api_keys`);

    // 4. Services reference users
    await queryRunner.query(`DELETE FROM services`);

    // 5. Now safe to delete users and members
    await queryRunner.query(`DELETE FROM members`);
    await queryRunner.query(`DELETE FROM users`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No revert — data deletion is irreversible
  }
}

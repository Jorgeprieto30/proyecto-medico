import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeSubscriptionExtras1743900000000 implements MigrationInterface {
  name = 'AddStripeSubscriptionExtras1743900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS current_period_end,
        DROP COLUMN IF EXISTS stripe_price_id
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeSubscriptionFields1743600000000 implements MigrationInterface {
  name = 'AddStripeSubscriptionFields1743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "subscription_status" varchar(20) NOT NULL DEFAULT 'trial',
        ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "trial_reservation_count" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "has_spot_addon" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "past_due_since" timestamptz NULL
    `);

    // services
    await queryRunner.query(`
      ALTER TABLE "services"
        ADD COLUMN IF NOT EXISTS "is_visible" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "plan_spot_limit" int NOT NULL DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "services"
        DROP COLUMN IF EXISTS "plan_spot_limit",
        DROP COLUMN IF EXISTS "is_visible"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "past_due_since",
        DROP COLUMN IF EXISTS "has_spot_addon",
        DROP COLUMN IF EXISTS "trial_reservation_count",
        DROP COLUMN IF EXISTS "stripe_subscription_id",
        DROP COLUMN IF EXISTS "stripe_customer_id",
        DROP COLUMN IF EXISTS "subscription_status"
    `);
  }
}

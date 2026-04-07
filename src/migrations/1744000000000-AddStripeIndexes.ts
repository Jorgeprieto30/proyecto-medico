import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeIndexes1744000000000 implements MigrationInterface {
  name = 'AddStripeIndexes1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Índice en stripe_customer_id: usado en todos los webhooks de facturación.
    // Sin él, cada evento hace un Full Table Scan sobre la tabla users.
    await queryRunner.query(`
      CREATE INDEX "IDX_users_stripe_customer_id"
      ON "users" ("stripe_customer_id")
      WHERE "stripe_customer_id" IS NOT NULL
    `);

    // Índice en stripe_subscription_id: necesario para futuras consultas
    // de gestión de suscripciones por ID de suscripción.
    await queryRunner.query(`
      CREATE INDEX "IDX_users_stripe_subscription_id"
      ON "users" ("stripe_subscription_id")
      WHERE "stripe_subscription_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_stripe_subscription_id"`);
    await queryRunner.query(`DROP INDEX "IDX_users_stripe_customer_id"`);
  }
}

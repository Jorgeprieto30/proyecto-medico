import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotSystem1742300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add user_id, max_spots, spot_label to services
    await queryRunner.query(`
      ALTER TABLE services
        ADD COLUMN user_id UUID REFERENCES users(id),
        ADD COLUMN max_spots INT NOT NULL DEFAULT 20,
        ADD COLUMN spot_label VARCHAR(50)
    `);

    // 2. Create session_spot_overrides table
    await queryRunner.query(`
      CREATE TABLE session_spot_overrides (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        slot_start TIMESTAMPTZ NOT NULL,
        max_spots INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT session_spot_overrides_unique UNIQUE (service_id, slot_start)
      )
    `);

    // 3. Add spot_number to reservations
    await queryRunner.query(`
      ALTER TABLE reservations ADD COLUMN spot_number INT
    `);

    // 4. Unique partial index: same spot cannot be booked twice for the same slot
    await queryRunner.query(`
      CREATE UNIQUE INDEX reservations_spot_unique_active
        ON reservations(service_id, slot_start, spot_number)
        WHERE status IN ('confirmed', 'pending') AND spot_number IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS reservations_spot_unique_active`);
    await queryRunner.query(`ALTER TABLE reservations DROP COLUMN IF EXISTS spot_number`);
    await queryRunner.query(`DROP TABLE IF EXISTS session_spot_overrides`);
    await queryRunner.query(`
      ALTER TABLE services
        DROP COLUMN IF EXISTS user_id,
        DROP COLUMN IF EXISTS max_spots,
        DROP COLUMN IF EXISTS spot_label
    `);
  }
}

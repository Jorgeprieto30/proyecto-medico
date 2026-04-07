import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberCenterVisits1743800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE member_center_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        center_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_member_center UNIQUE (member_id, center_user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_mcv_center_user ON member_center_visits (center_user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE member_center_visits`);
  }
}

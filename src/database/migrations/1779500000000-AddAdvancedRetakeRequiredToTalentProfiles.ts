import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdvancedRetakeRequiredToTalentProfiles1779500000000 implements MigrationInterface {
  name = 'AddAdvancedRetakeRequiredToTalentProfiles1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      ADD COLUMN IF NOT EXISTS "advanced_retake_required" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      DROP COLUMN IF EXISTS "advanced_retake_required"
    `);
  }
}

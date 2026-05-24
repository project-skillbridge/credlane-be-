import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssessmentLockedFromToTalentProfiles1779820000000 implements MigrationInterface {
  name = 'AddAssessmentLockedFromToTalentProfiles1779820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      ADD COLUMN IF NOT EXISTS "assessment_locked_from" timestamp with time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      DROP COLUMN IF EXISTS "assessment_locked_from"
    `);
  }
}

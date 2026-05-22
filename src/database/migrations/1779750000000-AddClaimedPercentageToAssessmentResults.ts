import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimedPercentageToAssessmentResults1779750000000 implements MigrationInterface {
  name = 'AddClaimedPercentageToAssessmentResults1779750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_results"
      ADD COLUMN IF NOT EXISTS "claimed_percentage" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_results"
      DROP COLUMN IF EXISTS "claimed_percentage"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerOnboardingDocFields1779840000000 implements MigrationInterface {
  name = 'AddEmployerOnboardingDocFields1779840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      ADD COLUMN IF NOT EXISTS "preferred_experience_levels" text[]
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      ADD COLUMN IF NOT EXISTS "linkedin_company_page_url" character varying(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      DROP COLUMN IF EXISTS "linkedin_company_page_url"
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      DROP COLUMN IF EXISTS "preferred_experience_levels"
    `);
  }
}

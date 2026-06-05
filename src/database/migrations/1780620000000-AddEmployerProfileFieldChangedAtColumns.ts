import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerProfileFieldChangedAtColumns1780620000000 implements MigrationInterface {
  name = 'AddEmployerProfileFieldChangedAtColumns1780620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      ADD COLUMN IF NOT EXISTS "company_name_changed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "company_website_changed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "linkedin_url_changed_at" timestamp with time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_profiles"
      DROP COLUMN IF EXISTS "company_name_changed_at",
      DROP COLUMN IF EXISTS "company_website_changed_at",
      DROP COLUMN IF EXISTS "linkedin_url_changed_at"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerVerificationFields1779840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "linkedin_company_url" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "hire_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "hire_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "is_verified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "linkedin_company_url"`,
    );
  }
}

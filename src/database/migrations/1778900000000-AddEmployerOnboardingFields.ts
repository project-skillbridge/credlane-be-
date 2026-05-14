import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerOnboardingFields1778900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ALTER COLUMN "company_name" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "joining_as" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "desired_roles" text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "region" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "hiring_count_range" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "company_website" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "company_website"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "hiring_count_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "desired_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "joining_as"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ALTER COLUMN "company_name" SET NOT NULL`,
    );
  }
}
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTalentOnboardingStepFields1778800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ALTER COLUMN "role_track" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "goal" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "role_tracks" text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "region" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "education_level" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "linkedin_url" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "onboarding_step" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "onboarding_step"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "linkedin_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "education_level"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "role_tracks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "goal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ALTER COLUMN "role_track" SET NOT NULL`,
    );
  }
}
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedAssessmentSubmitColumns1779300000000 implements MigrationInterface {
  name = 'AdvancedAssessmentSubmitColumns1779300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // assessment_responses: store rubric JSON per text answer
    await queryRunner.query(
      `ALTER TABLE "assessment_responses" ADD COLUMN IF NOT EXISTS "ai_evaluation_json" jsonb`,
    );

    // assessment_results: scoring metadata + guidance + integrity
    await queryRunner.query(
      `ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "max_score" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "percentage" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "guidance_report" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "integrity_confidence" character varying(10)`,
    );

    // employer_pool_profiles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employer_pool_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "talent_profile_id" uuid NOT NULL,
        "candidate_id" uuid NOT NULL,
        "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "track" character varying(100),
        "specialization" character varying(100),
        "verified_level" character varying(20) NOT NULL,
        "score" integer NOT NULL,
        "tier" character varying(20) NOT NULL,
        "strong_competencies" jsonb,
        "competency_scores" jsonb,
        "industry_background" jsonb,
        "work_preferences" jsonb,
        "availability" character varying(100),
        "location" character varying(200),
        "integrity_clean" boolean NOT NULL DEFAULT true,
        "profile_url" character varying(500),
        "shareable_link_token" character varying(64) UNIQUE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_pool_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employer_pool_profiles_talent" UNIQUE ("talent_profile_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_pool_profiles"`);
    await queryRunner.query(
      `ALTER TABLE "assessment_results" DROP COLUMN IF EXISTS "integrity_confidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" DROP COLUMN IF EXISTS "guidance_report"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" DROP COLUMN IF EXISTS "percentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_results" DROP COLUMN IF EXISTS "max_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_responses" DROP COLUMN IF EXISTS "ai_evaluation_json"`,
    );
  }
}

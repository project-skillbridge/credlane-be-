import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dedicated per-question score table.
 *
 * Per-question rows written by AdvancedAssessmentService.submit() after
 * rubric scoring + tier resolution. Enables clean competency aggregations
 * for the employer pool profile and per-question integrity audits without
 * parsing jsonb out of assessment_responses.
 */
export class CreateAssessmentScores1779400000000 implements MigrationInterface {
  name = 'CreateAssessmentScores1779400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assessment_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "attempt_id" uuid NOT NULL,
        "talent_profile_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "question_type" character varying(20) NOT NULL,
        "raw_score" double precision NOT NULL,
        "max_score" double precision NOT NULL,
        "pct_score" double precision NOT NULL,
        "competency" character varying(100),
        "integrity_flag" boolean NOT NULL DEFAULT false,
        "integrity_confidence" character varying(10),
        "ai_evaluation_json" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assessment_scores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assessment_scores_attempt"
          FOREIGN KEY ("attempt_id")
          REFERENCES "assessment_attempts"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assessment_scores_attempt" ON "assessment_scores" ("attempt_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assessment_scores_talent" ON "assessment_scores" ("talent_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assessment_scores_competency" ON "assessment_scores" ("competency")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assessment_scores_competency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assessment_scores_talent"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assessment_scores_attempt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_scores"`);
  }
}

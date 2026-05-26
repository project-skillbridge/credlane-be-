import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployerAssessmentTables1779860000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "employer_assessment_experience_level_enum" AS ENUM ('junior', 'mid', 'senior');
      CREATE TYPE "employer_assessment_question_source_enum" AS ENUM ('credlane_bank', 'company_questions');
      CREATE TYPE "employer_assessment_question_type_enum" AS ENUM ('multiple_choice', 'true_false', 'short_answer');
      CREATE TYPE "employer_assessment_delivery_mode_enum" AS ENUM ('link', 'direct');
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_assessments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "role_track" character varying(100) NOT NULL,
        "experience_level" "employer_assessment_experience_level_enum" NOT NULL,
        "time_limit_minutes" integer NOT NULL,
        "passing_threshold" integer NOT NULL,
        "question_source" "employer_assessment_question_source_enum" NOT NULL,
        "share_via_link" boolean NOT NULL DEFAULT false,
        "send_to_candidates" boolean NOT NULL DEFAULT false,
        "share_token" character varying(64) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_assessments_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_employer_assessments_time_limit" CHECK ("time_limit_minutes" IN (20, 30, 40, 60)),
        CONSTRAINT "CHK_employer_assessments_threshold" CHECK ("passing_threshold" BETWEEN 50 AND 90)
      );

      CREATE INDEX "IDX_employer_assessments_employer_active" ON "employer_assessments" ("employer_user_id", "is_active");
      CREATE UNIQUE INDEX "IDX_employer_assessments_share_token" ON "employer_assessments" ("share_token");
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_assessment_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "question_text" text NOT NULL,
        "question_type" "employer_assessment_question_type_enum" NOT NULL,
        "options" jsonb,
        "correct_answer" text NOT NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_assessment_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_assessment_questions_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX "UQ_employer_assessment_questions_assessment_position" ON "employer_assessment_questions" ("assessment_id", "position");
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_assessment_invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL,
        "candidate_user_id" uuid NOT NULL,
        "delivery_mode" "employer_assessment_delivery_mode_enum" NOT NULL,
        "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_assessment_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_assessment_invites_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_assessment_invites_candidate" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_employer_assessment_invites_assessment_candidate" UNIQUE ("assessment_id", "candidate_user_id")
      );

      CREATE INDEX "IDX_employer_assessment_invites_assessment" ON "employer_assessment_invites" ("assessment_id");
      CREATE INDEX "IDX_employer_assessment_invites_candidate" ON "employer_assessment_invites" ("candidate_user_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_assessment_submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL,
        "candidate_user_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "passed" boolean NOT NULL,
        "time_taken_seconds" integer NOT NULL,
        "delivery_mode" "employer_assessment_delivery_mode_enum" NOT NULL,
        "answers" jsonb,
        "completed_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_assessment_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_assessment_submissions_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_assessment_submissions_candidate" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_employer_assessment_submissions_score" CHECK ("score" BETWEEN 0 AND 100),
        CONSTRAINT "CHK_employer_assessment_submissions_time_nonnegative" CHECK ("time_taken_seconds" >= 0)
      );

      CREATE INDEX "IDX_employer_assessment_submissions_assessment" ON "employer_assessment_submissions" ("assessment_id");
      CREATE INDEX "IDX_employer_assessment_submissions_candidate" ON "employer_assessment_submissions" ("candidate_user_id");
      CREATE UNIQUE INDEX "UQ_employer_submission_assessment_candidate" ON "employer_assessment_submissions" ("assessment_id", "candidate_user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employer_assessment_submissions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employer_assessment_invites"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employer_assessment_questions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_assessments"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "employer_assessment_delivery_mode_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "employer_assessment_question_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "employer_assessment_question_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "employer_assessment_experience_level_enum"`,
    );
  }
}

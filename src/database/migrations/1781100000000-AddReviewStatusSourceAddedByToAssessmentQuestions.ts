import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewStatusSourceAddedByToAssessmentQuestions1781100000000 implements MigrationInterface {
  name = 'AddReviewStatusSourceAddedByToAssessmentQuestions1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "assessment_questions_review_status_enum" AS ENUM ('active', 'flagged', 'removed')
    `);
    await queryRunner.query(`
      CREATE TYPE "assessment_questions_source_enum" AS ENUM ('import', 'manual', 'ai_generated')
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
        ADD COLUMN "review_status" "assessment_questions_review_status_enum" NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
        ADD COLUMN "source" "assessment_questions_source_enum" NOT NULL DEFAULT 'import'
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
        ADD COLUMN "added_by" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
        ADD CONSTRAINT "FK_assessment_questions_added_by"
        FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      UPDATE "assessment_questions"
        SET "source" = 'ai_generated'
        WHERE "metadata"->>'generated' = 'true'
    `);
    await queryRunner.query(`
      CREATE TABLE "question_quality_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL,
        "author_id" uuid NULL,
        "note" text NOT NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_question_quality_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_question_quality_notes_question_id"
          FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_question_quality_notes_author_id"
          FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_question_quality_notes_question_id" ON "question_quality_notes" ("question_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "question_quality_notes"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP CONSTRAINT IF EXISTS "FK_assessment_questions_added_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP COLUMN IF EXISTS "added_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP COLUMN IF EXISTS "source"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP COLUMN IF EXISTS "review_status"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "assessment_questions_source_enum"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "assessment_questions_review_status_enum"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxAdvancedQuestionTrackLevelConstraint1779700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      DROP CONSTRAINT IF EXISTS "CHK_assessment_questions_type_fields"
    `);

    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      ADD CONSTRAINT "CHK_assessment_questions_type_fields"
      CHECK (
        (
          assessment_type = 'skill'
          AND track IS NOT NULL
          AND verified_level IS NOT NULL
          AND competency IS NOT NULL
          AND slot_type IS NULL
        ) OR (
          assessment_type = 'advanced'
          AND slot_type IS NOT NULL
          AND track IS NOT NULL
          AND verified_level IS NOT NULL
          AND competency IS NOT NULL
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_assessment_questions_bank_lookup"
      ON "assessment_questions" (assessment_type, track, verified_level, is_live)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_assessment_questions_bank_lookup"
    `);

    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      DROP CONSTRAINT IF EXISTS "CHK_assessment_questions_type_fields"
    `);

    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      ADD CONSTRAINT "CHK_assessment_questions_type_fields"
      CHECK (
        (
          assessment_type = 'skill'
          AND track IS NOT NULL
          AND verified_level IS NOT NULL
          AND competency IS NOT NULL
          AND slot_type IS NULL
        ) OR (
          assessment_type = 'advanced'
          AND slot_type IS NOT NULL
          AND track IS NULL
          AND verified_level IS NULL
          AND competency IS NULL
        )
      )
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxAdvancedQuestionTrackLevelConstraint1779700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      DROP CONSTRAINT IF EXISTS "CHK_assessment_questions_type_fields"
    `);

    await queryRunner.query(`
      UPDATE "assessment_questions"
      SET
        track = COALESCE(track, 'general'),
        verified_level = COALESCE(verified_level, 'entry'::verified_level_enum),
        competency = COALESCE(competency, 'legacy_placeholder'),
        slot_type = COALESCE(slot_type, 'situational'),
        is_live = false
      WHERE assessment_type = 'advanced'
        AND (
          track IS NULL
          OR verified_level IS NULL
          OR competency IS NULL
          OR slot_type IS NULL
        )
    `);

    await queryRunner.query(`
      UPDATE "assessment_questions"
      SET
        track = COALESCE(track, 'general'),
        verified_level = COALESCE(verified_level, 'entry'::verified_level_enum),
        competency = COALESCE(competency, 'legacy_placeholder'),
        slot_type = NULL,
        is_live = false
      WHERE assessment_type = 'skill'
        AND (
          track IS NULL
          OR verified_level IS NULL
          OR competency IS NULL
          OR slot_type IS NOT NULL
        )
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
      UPDATE "assessment_questions"
      SET track = NULL, verified_level = NULL, competency = NULL
      WHERE assessment_type = 'advanced'
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

import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateAssessmentTables1779200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create assessment_type enum (skill and advanced only - personal questions hardcoded on frontend)
    await queryRunner.query(`
      CREATE TYPE "assessment_type_enum" AS ENUM ('skill', 'advanced')
    `);

    // Create question_type enum
    await queryRunner.query(`
      CREATE TYPE "question_type_enum" AS ENUM ('single_pick', 'multi_pick', 'required_text', 'optional_text')
    `);

    // Create verified_level enum (renamed from skill_level for clarity)
    await queryRunner.query(`
      CREATE TYPE "verified_level_enum" AS ENUM ('entry', 'junior', 'mid', 'senior', 'expert')
    `);

    // Create assessment_tier enum
    await queryRunner.query(`
      CREATE TYPE "assessment_tier_enum" AS ENUM ('not_ready', 'emerging', 'job_ready')
    `);

    // Create slot_type enum for question categorization in advanced assessments
    await queryRunner.query(`
      CREATE TYPE "slot_type_enum" AS ENUM ('situational', 'work_task', 'reflection')
    `);

    // Create assessment_questions table (for skill and advanced assessments only)
    await queryRunner.createTable(
      new Table({
        name: 'assessment_questions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'assessment_type',
            type: 'assessment_type_enum',
          },
          {
            name: 'question_type',
            type: 'question_type_enum',
          },
          {
            name: 'question_text',
            type: 'text',
          },
          {
            name: 'question_number',
            type: 'integer',
          },
          {
            name: 'options',
            type: 'jsonb',
            isNullable: true,
            comment: 'Array of options for pick-type questions',
          },
          {
            name: 'correct_answer',
            type: 'text',
            isNullable: true,
            comment: 'Correct answer for skill assessment questions',
          },
          {
            name: 'track',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment:
              'Track for skill assessment questions (e.g., frontend_developer)',
          },
          {
            name: 'verified_level',
            type: 'verified_level_enum',
            isNullable: true,
            comment: 'Target verified level for this question',
          },
          {
            name: 'competency',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment:
              'Specific competency being tested (e.g., react-hooks, async-programming)',
          },
          {
            name: 'slot_type',
            type: 'slot_type_enum',
            isNullable: true,
            comment: 'Question categorization for advanced assessments',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment:
              'Structured metadata: { difficulty: "easy"|"medium"|"hard", estimated_time_seconds: number, tags: string[], rubric?: { criteria: string, max_points: number }[], author?: string, version?: number, explanation?: string, hints?: string[] }',
          },
          {
            name: 'is_live',
            type: 'boolean',
            default: false,
            comment: 'Whether question is active/published or draft',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Create index on assessment_type and track/verified_level for skill questions
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_questions_type" ON "assessment_questions" ("assessment_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_questions_track_level" ON "assessment_questions" ("track", "verified_level") WHERE "assessment_type" = 'skill'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_questions_live" ON "assessment_questions" ("is_live")
    `);

    // Add CHECK constraint to enforce metadata structure
    await queryRunner.query(`
      ALTER TABLE "assessment_questions"
      ADD CONSTRAINT "CHK_assessment_questions_metadata_valid"
      CHECK (
        metadata IS NULL OR (
          jsonb_typeof(metadata) = 'object'
          AND metadata ? 'difficulty'
          AND metadata ? 'estimated_time_seconds'
          AND metadata ? 'tags'
          AND (metadata->>'difficulty') IN ('easy', 'medium', 'hard')
          AND jsonb_typeof(metadata->'tags') = 'array'
          AND (metadata->>'estimated_time_seconds')::numeric > 0
        )
      )
    `);

    // Add CHECK constraint to enforce skill vs advanced field requirements
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

    // Create assessment_attempts table
    await queryRunner.createTable(
      new Table({
        name: 'assessment_attempts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'talent_profile_id',
            type: 'uuid',
            comment: 'Reference to talent taking the assessment',
          },
          {
            name: 'assessment_type',
            type: 'assessment_type_enum',
          },
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'Time limit for timed advanced assessments',
          },
          {
            name: 'tab_switch_count',
            type: 'integer',
            default: 0,
            comment: 'Number of times user switched tabs during assessment',
          },
          {
            name: 'force_submitted',
            type: 'boolean',
            default: false,
            comment: 'Whether assessment was auto-submitted due to violations',
          },
          {
            name: 'generated_questions_json',
            type: 'jsonb',
            isNullable: true,
            comment: 'AI-generated questions for advanced assessment only',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Add foreign key for talent_profile_id
    await queryRunner.createForeignKey(
      'assessment_attempts',
      new TableForeignKey({
        columnNames: ['talent_profile_id'],
        referencedTableName: 'talent_profiles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create index on talent_profile_id and assessment_type
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_attempts_talent_type" ON "assessment_attempts" ("talent_profile_id", "assessment_type")
    `);

    // Create assessment_responses table
    await queryRunner.createTable(
      new Table({
        name: 'assessment_responses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'attempt_id',
            type: 'uuid',
          },
          {
            name: 'question_id',
            type: 'uuid',
            isNullable: true,
            comment:
              'Null for advanced assessment (questions stored in attempt)',
          },
          {
            name: 'question_text',
            type: 'text',
            isNullable: true,
            comment: 'Question text for advanced assessment only',
          },
          {
            name: 'user_answer',
            type: 'jsonb',
            comment: 'User answer - can be string, array, or object',
          },
          {
            name: 'is_correct',
            type: 'boolean',
            isNullable: true,
            comment: 'For skill and advanced assessments only',
          },
          {
            name: 'answered_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'assessment_responses',
      new TableForeignKey({
        columnNames: ['attempt_id'],
        referencedTableName: 'assessment_attempts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'assessment_responses',
      new TableForeignKey({
        columnNames: ['question_id'],
        referencedTableName: 'assessment_questions',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Create index on attempt_id
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_responses_attempt" ON "assessment_responses" ("attempt_id")
    `);

    // Add CHECK constraint to ensure at least one of question_id or question_text is present
    await queryRunner.query(`
      ALTER TABLE "assessment_responses" 
      ADD CONSTRAINT "CHK_responses_question_present" 
      CHECK (question_id IS NOT NULL OR question_text IS NOT NULL)
    `);

    // Create talent_question_history table (tracks all questions talent has seen/answered)
    await queryRunner.createTable(
      new Table({
        name: 'talent_question_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'talent_profile_id',
            type: 'uuid',
            comment: 'Talent profile who answered the question',
          },
          {
            name: 'question_id',
            type: 'uuid',
            comment: 'Question that was answered',
          },
          {
            name: 'attempt_id',
            type: 'uuid',
            comment: 'Which assessment attempt this was part of',
          },
          {
            name: 'user_answer',
            type: 'jsonb',
            comment: 'The actual answer provided',
          },
          {
            name: 'is_correct',
            type: 'boolean',
            isNullable: true,
            comment:
              'Whether answer was correct (null for subjective questions)',
          },
          {
            name: 'raw_score',
            type: 'float',
            isNullable: true,
            comment: 'Raw points earned for this answer',
          },
          {
            name: 'max_score',
            type: 'float',
            isNullable: true,
            comment: 'Maximum possible points for this question',
          },
          {
            name: 'answered_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Add foreign keys to talent_question_history
    await queryRunner.createForeignKey(
      'talent_question_history',
      new TableForeignKey({
        columnNames: ['talent_profile_id'],
        referencedTableName: 'talent_profiles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'talent_question_history',
      new TableForeignKey({
        columnNames: ['question_id'],
        referencedTableName: 'assessment_questions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'talent_question_history',
      new TableForeignKey({
        columnNames: ['attempt_id'],
        referencedTableName: 'assessment_attempts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add unique constraint - prevent talent from seeing same question twice (across all attempts)
    await queryRunner.createUniqueConstraint(
      'talent_question_history',
      new TableUnique({
        name: 'uq_talent_question_history_talent_question',
        columnNames: ['talent_profile_id', 'question_id'],
      }),
    );

    // Add CHECK constraints for scoring fields
    await queryRunner.query(`
      ALTER TABLE "talent_question_history" 
      ADD CONSTRAINT "CHK_talent_question_history_scores_valid" 
      CHECK (
        (raw_score IS NULL OR raw_score >= 0) AND
        (max_score IS NULL OR max_score > 0) AND
        (raw_score IS NULL OR max_score IS NULL OR raw_score <= max_score)
      )
    `);

    // Create indexes on talent_question_history
    await queryRunner.query(`
      CREATE INDEX "idx_talent_question_history_talent_profile" ON "talent_question_history" ("talent_profile_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_talent_question_history_question" ON "talent_question_history" ("question_id")
    `);

    // Create assessment_results table
    await queryRunner.createTable(
      new Table({
        name: 'assessment_results',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'attempt_id',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'score',
            type: 'integer',
            comment: 'Score out of total questions (e.g., 7/10 or 75/100)',
          },
          {
            name: 'tier',
            type: 'assessment_tier_enum',
            isNullable: true,
            comment: 'Final tier for advanced assessment only',
          },
          {
            name: 'validated_level',
            type: 'verified_level_enum',
            isNullable: true,
            comment: 'Validated level for skill assessment only',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'assessment_results',
      new TableForeignKey({
        columnNames: ['attempt_id'],
        referencedTableName: 'assessment_attempts',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Add CHECK constraint to ensure score is non-negative
    await queryRunner.query(`
      ALTER TABLE "assessment_results" 
      ADD CONSTRAINT "CHK_assessment_score_non_negative" 
      CHECK (score >= 0)
    `);

    // Add assessment tracking fields to talent_profiles
    await queryRunner.query(`
      ALTER TABLE "talent_profiles" 
      ADD COLUMN IF NOT EXISTS "personal_assessment_answers" jsonb,
      ADD COLUMN IF NOT EXISTS "personal_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "skill_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "advanced_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "validated_level" verified_level_enum,
      ADD COLUMN IF NOT EXISTS "assessment_locked_until" timestamp with time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove assessment tracking fields from talent_profiles
    await queryRunner.query(`
      ALTER TABLE "talent_profiles" 
      DROP COLUMN IF EXISTS "assessment_locked_until",
      DROP COLUMN IF EXISTS "validated_level",
      DROP COLUMN IF EXISTS "advanced_assessment_completed_at",
      DROP COLUMN IF EXISTS "skill_assessment_completed_at",
      DROP COLUMN IF EXISTS "personal_assessment_completed_at",
      DROP COLUMN IF EXISTS "personal_assessment_answers"
    `);

    // Drop constraints before dropping tables
    await queryRunner.query(`
      ALTER TABLE "talent_question_history" DROP CONSTRAINT IF EXISTS "CHK_talent_question_history_scores_valid"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_results" DROP CONSTRAINT IF EXISTS "CHK_assessment_score_non_negative"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_responses" DROP CONSTRAINT IF EXISTS "CHK_responses_question_present"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP CONSTRAINT IF EXISTS "CHK_assessment_questions_metadata_valid"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_questions" DROP CONSTRAINT IF EXISTS "CHK_assessment_questions_type_fields"
    `);

    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('assessment_results', true);
    await queryRunner.dropTable('talent_question_history', true);
    await queryRunner.dropTable('assessment_responses', true);
    await queryRunner.dropTable('assessment_attempts', true);
    await queryRunner.dropTable('assessment_questions', true);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "slot_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assessment_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "verified_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assessment_type_enum"`);
  }
}

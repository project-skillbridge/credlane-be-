import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateAssessmentTables1779200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create assessment_type enum
    await queryRunner.query(`
      CREATE TYPE "assessment_type_enum" AS ENUM ('personal', 'skill', 'advanced')
    `);

    // Create question_type enum
    await queryRunner.query(`
      CREATE TYPE "question_type_enum" AS ENUM ('single_pick', 'multi_pick', 'required_text', 'optional_text')
    `);

    // Create skill_level enum
    await queryRunner.query(`
      CREATE TYPE "skill_level_enum" AS ENUM ('entry', 'junior', 'mid', 'senior', 'expert')
    `);

    // Create assessment_tier enum
    await queryRunner.query(`
      CREATE TYPE "assessment_tier_enum" AS ENUM ('not_ready', 'emerging', 'job_ready')
    `);

    // Create assessment_questions table
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
            name: 'section',
            type: 'integer',
            isNullable: true,
            comment: 'Section number for personal assessment (1-7)',
          },
          {
            name: 'question_number',
            type: 'integer',
          },
          {
            name: 'is_required',
            type: 'boolean',
            default: true,
          },
          {
            name: 'min_char_count',
            type: 'integer',
            isNullable: true,
            comment: 'Minimum character count for text responses',
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
            comment: 'Correct answer for skill assessment questions only',
          },
          {
            name: 'track',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Track for skill assessment questions only',
          },
          {
            name: 'level',
            type: 'skill_level_enum',
            isNullable: true,
            comment: 'Level for skill assessment questions only',
          },
          {
            name: 'has_follow_up',
            type: 'boolean',
            default: false,
            comment: 'Whether this question triggers an inline follow-up field',
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

    // Create index on assessment_type and track/level for skill questions
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_questions_type" ON "assessment_questions" ("assessment_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_questions_track_level" ON "assessment_questions" ("track", "level") WHERE "assessment_type" = 'skill'
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
            name: 'user_id',
            type: 'uuid',
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

    // Add foreign key for user_id
    await queryRunner.createForeignKey(
      'assessment_attempts',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create index on user_id and assessment_type
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_attempts_user_type" ON "assessment_attempts" ("user_id", "assessment_type")
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
        onDelete: 'SET NULL',
      }),
    );

    // Create index on attempt_id
    await queryRunner.query(`
      CREATE INDEX "idx_assessment_responses_attempt" ON "assessment_responses" ("attempt_id")
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
            type: 'skill_level_enum',
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
        onDelete: 'CASCADE',
      }),
    );

    // Add assessment tracking fields to talent_profiles
    await queryRunner.query(`
      ALTER TABLE "talent_profiles" 
      ADD COLUMN IF NOT EXISTS "personal_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "skill_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "advanced_assessment_completed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "validated_level" skill_level_enum,
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
      DROP COLUMN IF EXISTS "personal_assessment_completed_at"
    `);

    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('assessment_results', true);
    await queryRunner.dropTable('assessment_responses', true);
    await queryRunner.dropTable('assessment_attempts', true);
    await queryRunner.dropTable('assessment_questions', true);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "assessment_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "skill_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "question_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "assessment_type_enum"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceThresholdGroupWithLevel1780570000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new 'level' column
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ADD COLUMN "level" varchar(20)`,
    );

    // Migrate existing data: map old threshold_group values to level
    await queryRunner.query(
      `UPDATE "ai_learning_resources" SET "level" = CASE
        WHEN "threshold_group" = 'general' THEN 'general'
        WHEN "threshold_group" = 'below_50' THEN 'general'
        WHEN "threshold_group" = 'between_50_75' THEN 'mid'
        WHEN "threshold_group" = 'above_75' THEN 'senior'
        ELSE 'general'
      END`,
    );

    // Make level NOT NULL
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ALTER COLUMN "level" SET NOT NULL`,
    );

    // Drop old unique index on (track, threshold_group)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_learning_resources_track_threshold_group"`,
    );
    // Also try the auto-generated index name format
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_learning_resources_track_threshold"`,
    );

    // Drop the threshold_group column
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" DROP COLUMN "threshold_group"`,
    );

    // Drop the old enum type
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."score_threshold_group_enum"`,
    );

    // Deduplicate rows that collapsed into the same (track, level)
    await queryRunner.query(
      `DELETE FROM "ai_learning_resources" WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "track", "level" ORDER BY "id") AS rn
          FROM "ai_learning_resources"
        ) sub WHERE rn > 1
      )`,
    );

    // Create new unique index on (track, level)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ai_learning_resources_track_level" ON "ai_learning_resources" ("track", "level")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new unique index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_learning_resources_track_level"`,
    );

    // Recreate the old enum type
    await queryRunner.query(
      `CREATE TYPE "public"."score_threshold_group_enum" AS ENUM('general', 'below_50', 'between_50_75', 'above_75')`,
    );

    // Add threshold_group column back
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ADD COLUMN "threshold_group" "public"."score_threshold_group_enum"`,
    );

    // Map level back to threshold_group
    await queryRunner.query(
      `UPDATE "ai_learning_resources" SET "threshold_group" = CASE
        WHEN "level" = 'general' THEN 'general'
        WHEN "level" = 'junior' THEN 'below_50'
        WHEN "level" = 'mid' THEN 'between_50_75'
        WHEN "level" = 'senior' THEN 'above_75'
        WHEN "level" = 'expert' THEN 'above_75'
        ELSE 'general'
      END::"public"."score_threshold_group_enum"`,
    );

    // Make threshold_group NOT NULL
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ALTER COLUMN "threshold_group" SET NOT NULL`,
    );

    // Drop the level column
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" DROP COLUMN "level"`,
    );

    // Deduplicate rows that collapsed into the same (track, threshold_group)
    await queryRunner.query(
      `DELETE FROM "ai_learning_resources" WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "track", "threshold_group" ORDER BY "id") AS rn
          FROM "ai_learning_resources"
        ) sub WHERE rn > 1
      )`,
    );

    // Recreate old unique index
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ai_learning_resources_track_threshold_group" ON "ai_learning_resources" ("track", "threshold_group")`,
    );
  }
}

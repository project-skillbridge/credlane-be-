import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeneralToScoreThresholdGroupEnum1779830000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."score_threshold_group_enum" ADD VALUE IF NOT EXISTS 'general' BEFORE 'below_50'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing individual enum values.
    // To roll back, recreate the type without 'general' and migrate the column.
    await queryRunner.query(
      `DELETE FROM "ai_learning_resources" WHERE "threshold_group" = 'general'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ALTER COLUMN "threshold_group" TYPE text`,
    );
    await queryRunner.query(`DROP TYPE "public"."score_threshold_group_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."score_threshold_group_enum" AS ENUM('below_50', 'between_50_75', 'above_75')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_resources" ALTER COLUMN "threshold_group" TYPE "public"."score_threshold_group_enum" USING "threshold_group"::"public"."score_threshold_group_enum"`,
    );
  }
}

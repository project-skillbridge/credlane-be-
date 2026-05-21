import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiLearningResources1779350000000 implements MigrationInterface {
  name = 'CreateAiLearningResources1779350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."score_threshold_group_enum" AS ENUM('below_50', 'between_50_75', 'above_75')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_learning_resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "track" character varying(50) NOT NULL, "threshold_group" "public"."score_threshold_group_enum" NOT NULL, "banner_title" character varying(255) NOT NULL, "banner_description" text NOT NULL, "resources" jsonb NOT NULL, "videos" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1b0382169f60c3e2eae539fef73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2c2804fdf919dbddfcc2d4b4ef" ON "ai_learning_resources" ("track", "threshold_group") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c2804fdf919dbddfcc2d4b4ef"`,
    );
    await queryRunner.query(`DROP TABLE "ai_learning_resources"`);
    await queryRunner.query(`DROP TYPE "public"."score_threshold_group_enum"`);
  }
}

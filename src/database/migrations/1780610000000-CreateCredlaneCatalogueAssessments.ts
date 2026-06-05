import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCredlaneCatalogueAssessments1780610000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "credlane_catalogue_assessments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(255) NOT NULL,
        "description" text,
        "estimated_completion_time" character varying(100) NOT NULL,
        "role_track" character varying(100) NOT NULL,
        "experience_level" "employer_assessment_experience_level_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credlane_catalogue_assessments" PRIMARY KEY ("id")
      );

      CREATE INDEX "IDX_credlane_catalogue_assessments_active"
        ON "credlane_catalogue_assessments" ("is_active");

      CREATE INDEX "IDX_credlane_catalogue_assessments_track_level"
        ON "credlane_catalogue_assessments" ("role_track", "experience_level");
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_assessments"
        ADD COLUMN "credlane_assessment_id" uuid,
        ADD CONSTRAINT "FK_employer_assessments_credlane_catalogue"
          FOREIGN KEY ("credlane_assessment_id")
          REFERENCES "credlane_catalogue_assessments"("id")
          ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_assessments"
        DROP CONSTRAINT IF EXISTS "FK_employer_assessments_credlane_catalogue",
        DROP COLUMN IF EXISTS "credlane_assessment_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_credlane_catalogue_assessments_track_level";
      DROP INDEX IF EXISTS "IDX_credlane_catalogue_assessments_active";
      DROP TABLE IF EXISTS "credlane_catalogue_assessments";
    `);
  }
}

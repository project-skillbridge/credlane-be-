import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackendIntegrationEmployerTalentFlow1784000000000
  implements MigrationInterface
{
  name = 'BackendIntegrationEmployerTalentFlow1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."employer_role_visibility_enum" AS ENUM ('public', 'private');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."employer_assessment_type_enum" AS ENUM ('internal', 'external');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_roles"
      ADD COLUMN IF NOT EXISTS "visibility" "public"."employer_role_visibility_enum" NOT NULL DEFAULT 'public'
    `);
    await queryRunner.query(`
      ALTER TABLE "employer_roles"
      ADD COLUMN IF NOT EXISTS "applicant_cap" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "employer_roles"
      ADD COLUMN IF NOT EXISTS "interested_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "employer_assessments"
      ADD COLUMN IF NOT EXISTS "type" "public"."employer_assessment_type_enum" NOT NULL DEFAULT 'internal'
    `);
    await queryRunner.query(`
      ALTER TABLE "offers"
      ADD COLUMN IF NOT EXISTS "interview_link" character varying(1000)
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "assessment_unlocked_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "assessment_deadline"
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "extension_used"
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "expiry_warning_sent_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"
    `);
    await queryRunner.query(`
      UPDATE "offers"
      SET "status" = CASE
        WHEN "status"::text IN ('assessment_unlocked', 'assessment_completed', 'passed', 'hired') THEN 'accepted'
        WHEN "status"::text = 'failed' THEN 'declined'
        ELSE "status"::text
      END::offer_status_enum
      WHERE "status"::text IN ('assessment_unlocked', 'assessment_completed', 'passed', 'failed', 'hired')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_offers_active_employer_candidate"
      ON "offers" ("employer_user_id", "candidate_user_id", "role_id")
      WHERE "status" IN ('pending', 'accepted')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "talent_role_interests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "talent_user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_talent_role_interests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_talent_role_interests_talent_role" UNIQUE ("talent_user_id", "role_id"),
        CONSTRAINT "FK_talent_role_interests_talent" FOREIGN KEY ("talent_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_talent_role_interests_role" FOREIGN KEY ("role_id") REFERENCES "employer_roles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employer_assessment_external_applicants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assessment_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "consented_marketing" boolean NOT NULL,
        "consented_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "session_token" character varying(96) NOT NULL,
        "session_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_external_applicants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_external_applicants_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employer_assessment_external_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assessment_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_external_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_external_invites_assessment_email" UNIQUE ("assessment_id", "email"),
        CONSTRAINT "FK_external_invites_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employer_assessment_external_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assessment_id" uuid NOT NULL,
        "external_applicant_id" uuid NOT NULL,
        "responses" jsonb NOT NULL,
        "score" integer NOT NULL DEFAULT 0,
        "passed" boolean NOT NULL DEFAULT false,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_external_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_external_submission_assessment_applicant" UNIQUE ("assessment_id", "external_applicant_id"),
        CONSTRAINT "FK_external_submissions_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_external_submissions_applicant" FOREIGN KEY ("external_applicant_id") REFERENCES "employer_assessment_external_applicants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employer_roles_visibility" ON "employer_roles" ("visibility")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_talent_role_interests_talent_created" ON "talent_role_interests" ("talent_user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_talent_role_interests_role" ON "talent_role_interests" ("role_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_external_applicants_session_token" ON "employer_assessment_external_applicants" ("session_token")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_external_applicants_assessment_email" ON "employer_assessment_external_applicants" ("assessment_id", "email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_external_applicants_assessment" ON "employer_assessment_external_applicants" ("assessment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_external_invites_assessment" ON "employer_assessment_external_invites" ("assessment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_external_submissions_assessment" ON "employer_assessment_external_submissions" ("assessment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_submissions_assessment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_invites_assessment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_applicants_assessment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_external_applicants_assessment_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_applicants_session_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_talent_role_interests_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_talent_role_interests_talent_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employer_roles_visibility"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_assessment_external_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_assessment_external_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_assessment_external_applicants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "talent_role_interests"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN IF EXISTS "interview_link"`);
    await queryRunner.query(`ALTER TABLE "employer_assessments" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(`ALTER TABLE "employer_roles" DROP COLUMN IF EXISTS "interested_count"`);
    await queryRunner.query(`ALTER TABLE "employer_roles" DROP COLUMN IF EXISTS "applicant_cap"`);
    await queryRunner.query(`ALTER TABLE "employer_roles" DROP COLUMN IF EXISTS "visibility"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."employer_assessment_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."employer_role_visibility_enum"`);
  }
}

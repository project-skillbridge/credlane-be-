import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployerRoles1780580000000 implements MigrationInterface {
  name = 'CreateEmployerRoles1780580000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "employer_role_status_enum" AS ENUM ('active', 'closed')
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employer_user_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "category" varchar(255) NOT NULL,
        "description" text,
        "employment_type" varchar(50),
        "work_arrangement" varchar(50),
        "education" varchar(100),
        "keywords" text[],
        "salary_min" integer,
        "salary_max" integer,
        "currency" varchar(10),
        "assessment_id" uuid,
        "status" "employer_role_status_enum" NOT NULL DEFAULT 'active',
        "offers_sent_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_roles_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_roles_assessment" FOREIGN KEY ("assessment_id") REFERENCES "employer_assessments"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_employer_roles_employer" ON "employer_roles" ("employer_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employer_roles_status" ON "employer_roles" ("status")`,
    );

    // Add role_id column to offers table
    await queryRunner.query(`ALTER TABLE "offers" ADD COLUMN "role_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_role" FOREIGN KEY ("role_id") REFERENCES "employer_roles"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offers_role" ON "offers" ("role_id")`,
    );

    // Add offer lifecycle columns
    await queryRunner.query(
      `ALTER TABLE "offers" ADD COLUMN "assessment_unlocked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD COLUMN "assessment_deadline" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD COLUMN "extension_used" boolean NOT NULL DEFAULT false`,
    );

    // Expand offer_status_enum with new lifecycle states
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'assessment_unlocked'`,
    );
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'assessment_completed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'passed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'withdrawn'`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate"
      ON "offers" ("employer_user_id", "candidate_user_id")
      WHERE "status" IN ('pending', 'assessment_unlocked', 'assessment_completed', 'passed', 'accepted');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate"
      ON "offers" ("employer_user_id", "candidate_user_id")
      WHERE "status" IN ('pending', 'accepted');
    `);
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN IF EXISTS "extension_used"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN IF EXISTS "assessment_deadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN IF EXISTS "assessment_unlocked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT IF EXISTS "FK_offers_role"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_offers_role"`);
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN IF EXISTS "role_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_roles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employer_role_status_enum"`);
    // Note: Cannot remove enum values in PostgreSQL; they remain harmless
  }
}

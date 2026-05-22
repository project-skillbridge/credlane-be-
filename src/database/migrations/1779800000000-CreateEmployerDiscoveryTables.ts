import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployerDiscoveryTables1779800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "employer_saved_candidates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_user_id" uuid NOT NULL,
        "candidate_user_id" uuid NOT NULL,
        "employer_pool_profile_id" uuid,
        "notes" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_saved_candidates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employer_saved_candidate" UNIQUE ("employer_user_id", "candidate_user_id"),
        CONSTRAINT "FK_employer_saved_candidates_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_saved_candidates_candidate" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_saved_candidates_pool" FOREIGN KEY ("employer_pool_profile_id") REFERENCES "employer_pool_profiles"("id") ON DELETE SET NULL
      );

      CREATE INDEX "IDX_employer_saved_candidates_employer" ON "employer_saved_candidates" ("employer_user_id");
      CREATE INDEX "IDX_employer_saved_candidates_candidate" ON "employer_saved_candidates" ("candidate_user_id");
    `);

    await queryRunner.query(`
      CREATE TYPE "contact_request_status_enum" AS ENUM ('pending', 'read', 'responded');

      CREATE TABLE "employer_contact_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_user_id" uuid NOT NULL,
        "candidate_user_id" uuid NOT NULL,
        "message" text NOT NULL,
        "status" "contact_request_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_contact_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employer_contact_requests_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employer_contact_requests_candidate" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );

      CREATE INDEX "IDX_employer_contact_requests_employer" ON "employer_contact_requests" ("employer_user_id");
      CREATE INDEX "IDX_employer_contact_requests_candidate" ON "employer_contact_requests" ("candidate_user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_contact_requests"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "contact_request_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_saved_candidates"`);
  }
}

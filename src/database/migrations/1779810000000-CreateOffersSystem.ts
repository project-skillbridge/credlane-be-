import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOffersSystem1779810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TYPE "offer_status_enum" AS ENUM ('pending', 'accepted', 'declined', 'expired');

      CREATE TABLE "offers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_user_id" uuid NOT NULL,
        "candidate_user_id" uuid NOT NULL,
        "employer_pool_profile_id" uuid,
        "role_title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "status" "offer_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" timestamp with time zone NOT NULL,
        "responded_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offers_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offers_candidate" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offers_pool" FOREIGN KEY ("employer_pool_profile_id") REFERENCES "employer_pool_profiles"("id") ON DELETE SET NULL
      );

      CREATE INDEX "IDX_offers_employer" ON "offers" ("employer_user_id");
      CREATE INDEX "IDX_offers_candidate" ON "offers" ("candidate_user_id");
      CREATE INDEX "IDX_offers_status" ON "offers" ("status");
    `);

    await queryRunner.query(`
      CREATE TABLE "offer_distribution_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_user_id" uuid NOT NULL,
        "offer_id" uuid NOT NULL,
        "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offer_distribution_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offer_distribution_logs_employer" FOREIGN KEY ("employer_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offer_distribution_logs_offer" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE
      );

      CREATE INDEX "IDX_offer_distribution_logs_employer_sent" ON "offer_distribution_logs" ("employer_user_id", "sent_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "offer_distribution_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "offers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "offer_status_enum"`);
  }
}

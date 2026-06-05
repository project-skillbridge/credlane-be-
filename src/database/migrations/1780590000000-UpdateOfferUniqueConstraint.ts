import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the 2-column active-offer uniqueness index with two partial indexes:
 *
 *  1. UQ_offers_active_employer_candidate_role  — role-scoped offers
 *     (employer_user_id, candidate_user_id, role_id) WHERE role_id IS NOT NULL
 *
 *  2. UQ_offers_active_employer_candidate_no_role — legacy / role-less offers
 *     (employer_user_id, candidate_user_id) WHERE role_id IS NULL
 *
 * PostgreSQL treats NULLs as distinct in unique indexes, so a single 3-column
 * index (emp, cand, role_id) would allow unlimited null-role duplicates.
 * The second index closes that gap.
 */
export class UpdateOfferUniqueConstraint1780590000000 implements MigrationInterface {
  name = 'UpdateOfferUniqueConstraint1780590000000';

  private static readonly ACTIVE_STATUSES = `'pending', 'assessment_unlocked', 'assessment_completed', 'passed', 'accepted'`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate_role"
      ON "offers" ("employer_user_id", "candidate_user_id", "role_id")
      WHERE "role_id" IS NOT NULL
        AND "status" IN (${UpdateOfferUniqueConstraint1780590000000.ACTIVE_STATUSES})
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate_no_role"
      ON "offers" ("employer_user_id", "candidate_user_id")
      WHERE "role_id" IS NULL
        AND "status" IN (${UpdateOfferUniqueConstraint1780590000000.ACTIVE_STATUSES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate_role"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate_no_role"`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate"
      ON "offers" ("employer_user_id", "candidate_user_id")
      WHERE "status" IN (${UpdateOfferUniqueConstraint1780590000000.ACTIVE_STATUSES})
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds expiry_warning_sent_at to the offers table.
 * Used by OfferExpiryService to track whether a 24-hour pre-expiry warning
 * notification has already been sent for an offer, preventing duplicate alerts.
 */
export class AddExpiryWarningSentAt1780591000000 implements MigrationInterface {
  name = 'AddExpiryWarningSentAt1780591000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offers"
      ADD COLUMN IF NOT EXISTS "expiry_warning_sent_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "expiry_warning_sent_at"
    `);
  }
}

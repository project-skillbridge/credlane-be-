import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveOfferUniqueIndex1779870000000 implements MigrationInterface {
  name = 'AddActiveOfferUniqueIndex1779870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_offers_active_employer_candidate"
      ON "offers" ("employer_user_id", "candidate_user_id")
      WHERE "status" IN ('pending', 'accepted');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_offers_active_employer_candidate"`,
    );
  }
}

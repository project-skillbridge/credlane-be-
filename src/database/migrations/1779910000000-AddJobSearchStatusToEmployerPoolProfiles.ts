import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobSearchStatusToEmployerPoolProfiles1779910000000 implements MigrationInterface {
  name = 'AddJobSearchStatusToEmployerPoolProfiles1779910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_pool_profiles" ADD COLUMN IF NOT EXISTS "job_search_status" varchar(50)`,
    );

    // Backfill: if availability currently holds a job search value, move it to the new column
    await queryRunner.query(`
      UPDATE "employer_pool_profiles"
      SET "job_search_status" = "availability", "availability" = NULL
      WHERE "availability" IN ('actively_looking', 'open_to_opportunities', 'not_looking')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore job_search_status values back into availability before dropping
    await queryRunner.query(`
      UPDATE "employer_pool_profiles"
      SET "availability" = "job_search_status"
      WHERE "job_search_status" IS NOT NULL AND "availability" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "employer_pool_profiles" DROP COLUMN IF EXISTS "job_search_status"`,
    );
  }
}

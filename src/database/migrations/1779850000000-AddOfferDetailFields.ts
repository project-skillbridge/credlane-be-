import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfferDetailFields1779850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offers"
        ADD COLUMN IF NOT EXISTS "role_description" text,
        ADD COLUMN IF NOT EXISTS "compensation" character varying(255),
        ADD COLUMN IF NOT EXISTS "employment_type" character varying(50),
        ADD COLUMN IF NOT EXISTS "work_arrangement" character varying(50),
        ADD COLUMN IF NOT EXISTS "application_deadline" date;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offers"
        DROP COLUMN IF EXISTS "application_deadline",
        DROP COLUMN IF EXISTS "work_arrangement",
        DROP COLUMN IF EXISTS "employment_type",
        DROP COLUMN IF EXISTS "compensation",
        DROP COLUMN IF EXISTS "role_description";
    `);
  }
}

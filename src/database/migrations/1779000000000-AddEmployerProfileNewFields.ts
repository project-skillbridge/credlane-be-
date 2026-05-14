import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerProfileNewFields1779000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "employer_type" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "hiring_roles" text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" ADD COLUMN IF NOT EXISTS "hiring_locations" text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "hiring_locations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "hiring_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_profiles" DROP COLUMN IF EXISTS "employer_type"`,
    );
  }
}
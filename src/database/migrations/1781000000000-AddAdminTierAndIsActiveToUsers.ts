import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminTierAndIsActiveToUsers1781000000000 implements MigrationInterface {
  name = 'AddAdminTierAndIsActiveToUsers1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_admin_tier_enum" AS ENUM ('super_admin', 'admin', 'reviewer')
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "admin_tier" "users_admin_tier_enum" NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "is_active" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_tier"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "users_admin_tier_enum"
    `);
  }
}

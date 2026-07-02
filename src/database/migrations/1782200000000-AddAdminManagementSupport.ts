import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminManagementSupport1782200000000 implements MigrationInterface {
  name = 'AddAdminManagementSupport1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "last_login_at" TIMESTAMP WITH TIME ZONE NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_email_change_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "target_user_id" uuid NOT NULL,
        "previous_email" varchar(255) NOT NULL,
        "new_email" varchar(255) NOT NULL,
        "changed_by_user_id" uuid NOT NULL,
        "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_email_change_audits" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_email_change_audits_target_user_id"
        ON "admin_email_change_audits" ("target_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_admin_email_change_audits_target_user_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "admin_email_change_audits"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at"
    `);
  }
}

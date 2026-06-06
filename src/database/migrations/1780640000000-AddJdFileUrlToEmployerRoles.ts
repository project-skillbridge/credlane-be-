import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJdFileUrlToEmployerRoles1780640000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_roles" ADD COLUMN IF NOT EXISTS "jd_file_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employer_roles" DROP COLUMN IF EXISTS "jd_file_url"`,
    );
  }
}

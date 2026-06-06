import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueEmployerRoleTitle1780651000000 implements MigrationInterface {
  name = 'AddUniqueEmployerRoleTitle1780651000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_roles"
        ADD CONSTRAINT "UQ_employer_roles_employer_title"
        UNIQUE ("employer_user_id", "title")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employer_roles"
        DROP CONSTRAINT IF EXISTS "UQ_employer_roles_employer_title"
    `);
  }
}

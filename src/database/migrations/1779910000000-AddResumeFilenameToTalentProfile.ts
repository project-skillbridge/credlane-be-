import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeFilenameToTalentProfile1779910000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD "resume_filename" character varying(255)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN "resume_filename"`,
    );
  }
}

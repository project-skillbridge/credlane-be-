import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCopyPasteCountToAttempts1779310000000 implements MigrationInterface {
  name = 'AddCopyPasteCountToAttempts1779310000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessment_attempts" ADD COLUMN IF NOT EXISTS "copy_paste_count" integer NOT NULL DEFAULT 0`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessment_attempts" DROP COLUMN IF EXISTS "copy_paste_count"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds copy_paste_count to assessment_attempts so the per-attempt integrity
 * confidence can include copy-paste events.
 */
export class AddCopyPasteCountToAttempts1779410000000
  implements MigrationInterface
{
  name = 'AddCopyPasteCountToAttempts1779410000000';

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

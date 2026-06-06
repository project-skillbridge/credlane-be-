import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualAndAdminUploadToAssessmentQuestionSource1780630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "employer_assessment_question_source_enum" ADD VALUE IF NOT EXISTS 'manual'`,
    );
    await queryRunner.query(
      `ALTER TYPE "employer_assessment_question_source_enum" ADD VALUE IF NOT EXISTS 'admin_upload'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
  }
}

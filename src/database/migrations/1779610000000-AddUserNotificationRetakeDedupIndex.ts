import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationRetakeDedupIndex1779610000000 implements MigrationInterface {
  name = 'AddUserNotificationRetakeDedupIndex1779610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_notifications_retake_eligibility"
      ON "user_notifications" ("user_id", "type", (data->>'eligibility_date'))
      WHERE "type" = 'advanced_retake_available'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_user_notifications_retake_eligibility"`,
    );
  }
}

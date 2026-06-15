import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationJobReadyDigestDedupIndex1779870000000 implements MigrationInterface {
  name = 'AddUserNotificationJobReadyDigestDedupIndex1779870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_notifications_job_ready_digest_week"
      ON "user_notifications" ("user_id", "type", (data->>'digest_week_start'))
      WHERE "type" = 'job_ready_matches_available'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_user_notifications_job_ready_digest_week"`,
    );
  }
}

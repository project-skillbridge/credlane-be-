import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTalentSettingsFieldsAndNotificationPreferences1779900000000 implements MigrationInterface {
  name = 'AddTalentSettingsFieldsAndNotificationPreferences1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "personal_website" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "resume_url" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "availability_status" varchar(50) NOT NULL DEFAULT 'open_to_opportunities'`,
    );
    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      ADD CONSTRAINT "CHK_talent_profiles_availability_status"
      CHECK ("availability_status" IN ('actively_looking', 'open_to_opportunities', 'not_looking'))
    `);

    await queryRunner.createTable(
      new Table({
        name: 'user_notification_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'channel', type: 'varchar', length: '20', isNullable: false },
          { name: 'type', type: 'varchar', length: '64', isNullable: false },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD CONSTRAINT "FK_user_notification_preferences_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD CONSTRAINT "CHK_user_notification_preferences_channel"
      CHECK ("channel" IN ('email', 'in_app'))
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD CONSTRAINT "CHK_user_notification_preferences_type"
      CHECK (
        "type" IN (
          'advanced_assessment_score_ready',
          'advanced_retake_available',
          'offer_received',
          'offer_accepted',
          'offer_declined',
          'contact_request_received',
          'assessment_received',
          'job_ready_matches_available'
        )
      )
    `);

    await queryRunner.createIndex(
      'user_notification_preferences',
      new TableIndex({
        name: 'UQ_user_notification_preferences_user_channel_type',
        columnNames: ['user_id', 'channel', 'type'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'user_notification_preferences',
      'UQ_user_notification_preferences_user_channel_type',
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "user_notification_preferences" DROP CONSTRAINT IF EXISTS "CHK_user_notification_preferences_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "user_notification_preferences" DROP CONSTRAINT IF EXISTS "CHK_user_notification_preferences_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "user_notification_preferences" DROP CONSTRAINT IF EXISTS "FK_user_notification_preferences_user_id"`,
    );
    await queryRunner.dropTable('user_notification_preferences');
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "talent_profiles" DROP CONSTRAINT IF EXISTS "CHK_talent_profiles_availability_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "availability_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "resume_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "personal_website"`,
    );
  }
}

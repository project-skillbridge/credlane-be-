import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class AddTalentSettingsFieldsAndNotificationPreferences1779900000000
  implements MigrationInterface
{
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
    await queryRunner.dropTable('user_notification_preferences');
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

import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateEmailChangeOtps1779880000000 implements MigrationInterface {
  name = 'CreateEmailChangeOtps1779880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'email_change_otps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'new_email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'otp_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'used_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'email_change_otps',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'email_change_otps',
      new TableIndex({
        name: 'IDX_email_change_otps_user_email_created_at',
        columnNames: ['user_id', 'new_email', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'email_change_otps',
      'IDX_email_change_otps_user_email_created_at',
    );

    const table = await queryRunner.getTable('email_change_otps');
    const userForeignKey = table?.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames[0] === 'user_id',
    );
    if (userForeignKey) {
      await queryRunner.dropForeignKey('email_change_otps', userForeignKey);
    }

    await queryRunner.dropTable('email_change_otps');
  }
}

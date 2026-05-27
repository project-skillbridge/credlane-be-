import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAccountDeletionAudits1779890000000 implements MigrationInterface {
  name = 'CreateAccountDeletionAudits1779890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'account_deletion_audits',
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
            name: 'email_at_deletion',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'first_name_at_deletion',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'last_name_at_deletion',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'country',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'deletion_type',
            type: 'varchar',
            length: '50',
            default: `'self_service'`,
            isNullable: false,
          },
          {
            name: 'deleted_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'account_deletion_audits',
      new TableIndex({
        name: 'IDX_account_deletion_audits_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'account_deletion_audits',
      new TableIndex({
        name: 'IDX_account_deletion_audits_email_at_deletion',
        columnNames: ['email_at_deletion'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'account_deletion_audits',
      'IDX_account_deletion_audits_email_at_deletion',
    );
    await queryRunner.dropIndex(
      'account_deletion_audits',
      'IDX_account_deletion_audits_user_id',
    );
    await queryRunner.dropTable('account_deletion_audits');
  }
}

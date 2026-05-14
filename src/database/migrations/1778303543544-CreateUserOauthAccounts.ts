import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserOauthAccounts1778303543544 implements MigrationInterface {
  name = 'CreateUserOauthAccounts1778303543544';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_oauth_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" character varying(20) NOT NULL, "provider_id" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_oauth_accounts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "FK_a093a39110ecd3602d87f0e814b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_oauth_accounts" DROP CONSTRAINT "FK_a093a39110ecd3602d87f0e814b"`,
    );
    await queryRunner.query(`DROP TABLE "user_oauth_accounts"`);
  }
}

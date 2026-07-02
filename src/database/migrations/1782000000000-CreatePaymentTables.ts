import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1782000000000 implements MigrationInterface {
  name = 'CreatePaymentTables1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "employer_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "price" decimal(10,2) NOT NULL DEFAULT 0,
        "offer_limit" int NULL,
        "features" jsonb NULL,
        "is_free" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_packages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_employer_packages_name"
        ON "employer_packages" ("name")
    `);

    await queryRunner.query(`
      CREATE TABLE "employer_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_id" uuid NOT NULL,
        "package_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'free',
        "start_date" timestamptz NOT NULL,
        "next_billing_date" timestamptz NULL,
        "grace_period_ends_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employer_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "CK_employer_subscriptions_status" CHECK ("status" IN ('active', 'past_due', 'cancelled', 'free'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_employer_subscriptions_employer_id"
        ON "employer_subscriptions" ("employer_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_subscriptions"
        ADD CONSTRAINT "FK_employer_subscriptions_employer"
        FOREIGN KEY ("employer_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "employer_subscriptions"
        ADD CONSTRAINT "FK_employer_subscriptions_package"
        FOREIGN KEY ("package_id") REFERENCES "employer_packages"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE "talent_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "talent_id" uuid NOT NULL,
        "price" decimal(10,2) NULL,
        "status" varchar(20) NOT NULL DEFAULT 'free',
        "start_date" timestamptz NOT NULL,
        "next_billing_date" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_talent_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_talent_subscriptions_talent_id"
        ON "talent_subscriptions" ("talent_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "talent_subscriptions"
        ADD CONSTRAINT "FK_talent_subscriptions_talent"
        FOREIGN KEY ("talent_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "talent_subscriptions"
        ADD CONSTRAINT "CK_talent_subscriptions_status"
        CHECK ("status" IN ('active', 'cancelled', 'free'))
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "subscriber_id" uuid NOT NULL,
        "subscriber_type" varchar(20) NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "status" varchar(20) NOT NULL,
        "employer_subscription_id" uuid NULL,
        "talent_subscription_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "FK_transactions_employer_subscription"
        FOREIGN KEY ("employer_subscription_id") REFERENCES "employer_subscriptions"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "FK_transactions_talent_subscription"
        FOREIGN KEY ("talent_subscription_id") REFERENCES "talent_subscriptions"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "CK_transactions_subscriber_type"
        CHECK ("subscriber_type" IN ('employer', 'talent'))
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "CK_transactions_status"
        CHECK ("status" IN ('successful', 'failed', 'refunded'))
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "CK_transactions_linkage"
        CHECK (
          ("subscriber_type" = 'employer' AND "talent_subscription_id" IS NULL)
          OR
          ("subscriber_type" = 'talent' AND "employer_subscription_id" IS NULL)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CK_transactions_linkage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CK_transactions_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CK_transactions_subscriber_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_subscriptions" DROP CONSTRAINT IF EXISTS "CK_talent_subscriptions_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employer_subscriptions" DROP CONSTRAINT IF EXISTS "CK_employer_subscriptions_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "talent_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employer_packages"`);
  }
}

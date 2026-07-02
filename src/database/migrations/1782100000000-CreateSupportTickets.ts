import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTickets1782100000000 implements MigrationInterface {
  name = 'CreateSupportTickets1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" varchar(32) NOT NULL,
        "submitted_by_user_id" uuid NULL,
        "submitter_name" varchar(255) NOT NULL,
        "submitter_email" varchar(255) NULL,
        "submitter_role" varchar(20) NOT NULL,
        "type" varchar(40) NOT NULL,
        "subject" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "assigned_admin_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_support_tickets_ticket_id" UNIQUE ("ticket_id"),
        CONSTRAINT "CK_support_tickets_type" CHECK ("type" IN ('account', 'assessment', 'employer', 'payment', 'technical', 'other')),
        CONSTRAINT "CK_support_tickets_status" CHECK ("status" IN ('open', 'in_progress', 'resolved'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_support_tickets_status_type_created_at"
        ON "support_tickets" ("status", "type", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_support_tickets_submitter_name"
        ON "support_tickets" ("submitter_name")
    `);

    await queryRunner.query(`
      ALTER TABLE "support_tickets"
        ADD CONSTRAINT "FK_support_tickets_submitted_by"
        FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "support_tickets"
        ADD CONSTRAINT "FK_support_tickets_assigned_admin"
        FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "support_ticket_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid NOT NULL,
        "author_type" varchar(20) NOT NULL,
        "author_user_id" uuid NULL,
        "author_name" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_support_ticket_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CK_support_ticket_messages_author_type" CHECK ("author_type" IN ('submitter', 'admin', 'system'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_support_ticket_messages_ticket_created_at"
        ON "support_ticket_messages" ("ticket_id", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "support_ticket_messages"
        ADD CONSTRAINT "FK_support_ticket_messages_ticket"
        FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "support_ticket_messages"
        ADD CONSTRAINT "FK_support_ticket_messages_author"
        FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
  }
}

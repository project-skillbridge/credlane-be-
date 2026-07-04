import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiUsageLogs1782300000000 implements MigrationInterface {
  name = 'CreateAiUsageLogs1782300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_usage_logs" (
        "id"            UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "tag"           VARCHAR(64)   NOT NULL,
        "provider"      VARCHAR(128),
        "model_id"      VARCHAR(256),
        "input_tokens"  INTEGER,
        "output_tokens" INTEGER,
        "total_tokens"  INTEGER,
        "cost_usd"      NUMERIC(18,10),
        "duration_ms"   INTEGER       NOT NULL,
        "created_at"    TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_usage_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_logs_tag_created_at" ON "ai_usage_logs" ("tag", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_logs_created_at" ON "ai_usage_logs" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_usage_logs"`);
  }
}

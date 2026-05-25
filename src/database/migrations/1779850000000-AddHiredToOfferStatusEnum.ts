import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHiredToOfferStatusEnum1779850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "offer_status_enum" ADD VALUE IF NOT EXISTS 'hired'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTalentTrackAndProfileVerified1779100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "track" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "profile_verified" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "profile_verified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "track"`,
    );
  }
}
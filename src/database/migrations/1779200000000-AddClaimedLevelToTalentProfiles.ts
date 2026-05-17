import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimedLevelToTalentProfiles1779200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ADD COLUMN IF NOT EXISTS "claimed_level" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "claimed_level"`,
    );
  }
}

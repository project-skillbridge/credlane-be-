import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimedLevelToTalentProfiles1779210000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('talent_profiles');
    const column = table?.findColumnByName('claimed_level');

    if (!column) {
      await queryRunner.query(
        `ALTER TABLE "talent_profiles" ADD COLUMN "claimed_level" character varying(50)`,
      );
      return;
    }

    if (column.type !== 'varchar' && column.type !== 'character varying') {
      await queryRunner.query(
        `ALTER TABLE "talent_profiles" ALTER COLUMN "claimed_level" TYPE character varying(50) USING "claimed_level"::text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN "claimed_level"`,
    );
  }
}

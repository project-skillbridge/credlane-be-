import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimedLevelToTalentProfiles1779210000000 implements MigrationInterface {
  private readonly claimedLevelToEnumUsing = `
    CASE "claimed_level"::text
      WHEN 'beginner' THEN 'entry'::verified_level_enum
      WHEN 'intermediate' THEN 'mid'::verified_level_enum
      WHEN 'advanced' THEN 'senior'::verified_level_enum
      WHEN 'expert' THEN 'expert'::verified_level_enum
      WHEN 'entry' THEN 'entry'::verified_level_enum
      WHEN 'junior' THEN 'junior'::verified_level_enum
      WHEN 'mid' THEN 'mid'::verified_level_enum
      WHEN 'senior' THEN 'senior'::verified_level_enum
      ELSE NULL
    END
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('talent_profiles');
    const column = table?.findColumnByName('claimed_level');

    if (!column) {
      await queryRunner.query(
        `ALTER TABLE "talent_profiles" ADD COLUMN "claimed_level" verified_level_enum`,
      );
      return;
    }

    if (column.enumName === 'verified_level_enum') {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "talent_profiles" ALTER COLUMN "claimed_level" TYPE verified_level_enum USING (${this.claimedLevelToEnumUsing})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "talent_profiles" DROP COLUMN IF EXISTS "claimed_level"`,
    );
  }
}

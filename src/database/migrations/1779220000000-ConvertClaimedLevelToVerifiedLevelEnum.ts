import { MigrationInterface, QueryRunner } from 'typeorm';

/** For databases that already ran 177921 when it added varchar(50). */
export class ConvertClaimedLevelToVerifiedLevelEnum1779220000000 implements MigrationInterface {
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

    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      ALTER COLUMN "claimed_level" TYPE verified_level_enum
      USING (
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
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('talent_profiles');
    const column = table?.findColumnByName('claimed_level');
    if (!column || column.enumName !== 'verified_level_enum') {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "talent_profiles"
      ALTER COLUMN "claimed_level" TYPE character varying(50)
      USING (
        CASE "claimed_level"::text
          WHEN 'entry' THEN 'beginner'
          WHEN 'junior' THEN 'intermediate'
          WHEN 'mid' THEN 'intermediate'
          WHEN 'senior' THEN 'advanced'
          WHEN 'expert' THEN 'expert'
          ELSE NULL
        END
      )
    `);
  }
}

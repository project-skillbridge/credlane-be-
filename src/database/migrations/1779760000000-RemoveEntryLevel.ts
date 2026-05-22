import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEntryLevel1779760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate all 'entry' values to 'junior' across every table
    await queryRunner.query(`
      UPDATE talent_profiles
      SET validated_level = 'junior'
      WHERE validated_level = 'entry'
    `);

    await queryRunner.query(`
      UPDATE talent_profiles
      SET claimed_level = 'junior'
      WHERE claimed_level = 'entry'
    `);

    await queryRunner.query(`
      UPDATE employer_pool_profiles
      SET verified_level = 'junior'
      WHERE verified_level = 'entry'
    `);

    await queryRunner.query(`
      UPDATE assessment_results
      SET validated_level = 'junior'
      WHERE validated_level = 'entry'
    `);

    await queryRunner.query(`
      UPDATE assessment_questions
      SET verified_level = 'junior'
      WHERE verified_level = 'entry'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No reliable way to reverse — we don't know which rows were originally 'entry'.
    // The old 'entry' value still exists in the verified_level_enum type in Postgres,
    // so nothing is broken. This migration is forward-only for data.
  }
}

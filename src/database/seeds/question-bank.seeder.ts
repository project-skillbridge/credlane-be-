import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AssessmentQuestion } from '../../modules/assessments/entities/assessment-question.entity';
import { QuestionImportService } from '../import/question-import.service';
import { Seeder } from './seeder.interface';

const BANKS_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'data',
  'question-banks',
);

const DEFAULT_SEED_FILES = [
  path.join(BANKS_DIR, 'seed-skill.json'),
  path.join(BANKS_DIR, 'seed-advanced.json'),
];

export const questionBankSeeder: Seeder = {
  name: 'QuestionBankSeeder',
  async run(dataSource: DataSource) {
    const service = new QuestionImportService(
      dataSource.getRepository(AssessmentQuestion),
    );

    await service.deactivateLegacyPlaceholderQuestions();

    // Allow a single override file via env var (e.g. for targeted re-seeding)
    const override = process.env.QUESTION_BANK_SEED_FILE;
    const seedFiles = override ? [override] : DEFAULT_SEED_FILES;

    for (const seedFile of seedFiles) {
      if (!fs.existsSync(seedFile)) {
        console.log(
          `[QuestionBankSeeder] no seed file at ${seedFile} — skipping`,
        );
        continue;
      }

      const result = await service.importFromText(
        fs.readFileSync(seedFile, 'utf-8'),
      );
      console.log(
        `[QuestionBankSeeder] ${path.basename(seedFile)}: inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
      );
    }
  },
};

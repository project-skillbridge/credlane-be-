import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AssessmentQuestion } from '../../modules/assessments/entities/assessment-question.entity';
import { QuestionImportService } from '../import/question-import.service';
import { Seeder } from './seeder.interface';

const DEFAULT_SEED_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'data',
  'question-banks',
  'seed-advanced.json',
);

export const questionBankSeeder: Seeder = {
  name: 'QuestionBankSeeder',
  async run(dataSource: DataSource) {
    const seedFile = process.env.QUESTION_BANK_SEED_FILE ?? DEFAULT_SEED_FILE;
    const service = new QuestionImportService(
      dataSource.getRepository(AssessmentQuestion),
    );

    await service.deactivateLegacyPlaceholderQuestions();

    if (!fs.existsSync(seedFile)) {
      console.log(
        `[QuestionBankSeeder] no seed file at ${seedFile} — skipping question import`,
      );
      return;
    }

    const result = await service.importFromText(
      fs.readFileSync(seedFile, 'utf-8'),
    );
    console.log(
      `[QuestionBankSeeder] inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
    );
  },
};

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../data-source';
import { QuestionImportService } from './question-import.service';
import { AssessmentQuestion } from '../../modules/assessments/entities/assessment-question.entity';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function run() {
  const filePath = readArg('--file');
  const driveUrl = readArg('--drive-url');

  if (!filePath && !driveUrl) {
    console.error(
      'Usage: pnpm import:questions -- --file <path> | --drive-url <url>',
    );
    process.exit(1);
  }

  await dataSource.initialize();

  const service = new QuestionImportService(
    dataSource.getRepository(AssessmentQuestion),
  );

  await service.deactivateLegacyPlaceholderQuestions();

  const result = filePath
    ? await service.importFromText(
        fs.readFileSync(path.resolve(filePath), 'utf-8'),
      )
    : await service.importFromInput({ driveUrl });

  console.log(JSON.stringify(result, null, 2));
  await dataSource.destroy();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

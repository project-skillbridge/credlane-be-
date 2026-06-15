import 'reflect-metadata';
import dataSource from '../data-source';
import { Seeder } from './seeder.interface';
import { questionBankSeeder } from './question-bank.seeder';
import { userSeeder } from './user.seeder';
import { talentSeeder } from './talent.seeder';

const seeders: Seeder[] = [userSeeder, questionBankSeeder, talentSeeder];

async function run() {
  await dataSource.initialize();
  console.log('Running seeders…');
  for (const seeder of seeders) {
    console.log(`→ ${seeder.name}`);
    await seeder.run(dataSource);
  }
  await dataSource.destroy();
  console.log('Done.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

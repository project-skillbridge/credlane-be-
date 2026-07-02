import { DataSource } from 'typeorm';
import { EmployerPackage } from '../../modules/payments/entities/employer-package.entity';
import { Seeder } from './seeder.interface';

export const employerPackageSeeder: Seeder = {
  name: 'EmployerPackageSeeder',
  async run(dataSource: DataSource) {
    const repo = dataSource.getRepository(EmployerPackage);

    const existing = await repo.find({ select: ['name'] });
    const existingNames = new Set(existing.map((p) => p.name));

    const defaults = [
      repo.create({
        name: 'Free',
        price: 0,
        offer_limit: 2,
        features: null,
        is_free: true,
      }),
      repo.create({
        name: 'Paid',
        price: 0,
        offer_limit: null,
        features: null,
        is_free: false,
      }),
    ];

    const missing = defaults.filter((p) => !existingNames.has(p.name));
    if (missing.length === 0) {
      console.log(
        '[EmployerPackageSeeder] all packages already exist - skipping',
      );
      return;
    }

    await repo.save(missing);
    console.log(
      `[EmployerPackageSeeder] inserted missing packages: ${missing.map((p) => p.name).join(', ')}`,
    );
  },
};

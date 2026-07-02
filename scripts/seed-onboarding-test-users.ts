import 'reflect-metadata';
import * as argon2 from 'argon2';
import dataSource from '../src/database/data-source';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { TalentProfile, TalentProfileStatus } from '../src/modules/talent/entities/talent-profile.entity';
import { EmployerProfile } from '../src/modules/employer/entities/employer-profile.entity';

async function run() {
  await dataSource.initialize();
  console.log('Database connected.');

  const passwordHash = await argon2.hash('Password123!');
  const userRepo = dataSource.getRepository(User);
  const talentRepo = dataSource.getRepository(TalentProfile);
  const employerRepo = dataSource.getRepository(EmployerProfile);

  console.log('Seeding 22 Talent users...');
  const talents = [];
  for (let i = 1; i <= 22; i++) {
    const email = `talent_test_${i}@skillbridge.com`.toLowerCase();
    
    // Check if user exists
    let user = await userRepo.findOne({ where: { email } });
    if (!user) {
      user = userRepo.create({
        email,
        password: passwordHash,
        first_name: `TestTalent`,
        last_name: `${i}`,
        country: 'Nigeria',
        is_verified: true,
        onboarding_complete: false,
        role: UserRole.TALENT,
      });
      await userRepo.save(user);
    }

    // Ensure talent profile exists and is in "not completed onboarding" state
    let profile = await talentRepo.findOne({ where: { user_id: user.id } });
    if (!profile) {
      profile = talentRepo.create({
        user_id: user.id,
        onboarding_step: 0,
        status: TalentProfileStatus.NOT_STARTED,
        profile_verified: false,
      });
      await talentRepo.save(profile);
    }
    talents.push({ email, password: 'Password123!' });
  }

  console.log('Seeding 1 Employer user...');
  const empEmail = 'employer_test_1@skillbridge.com';
  let empUser = await userRepo.findOne({ where: { email: empEmail } });
  if (!empUser) {
    empUser = userRepo.create({
      email: empEmail,
      password: passwordHash,
      first_name: 'TestEmployer',
      last_name: '1',
      country: 'Nigeria',
      is_verified: true,
      onboarding_complete: false,
      role: UserRole.EMPLOYER,
    });
    await userRepo.save(empUser);
  }

  let empProfile = await employerRepo.findOne({ where: { user_id: empUser.id } });
  if (!empProfile) {
    empProfile = employerRepo.create({
      user_id: empUser.id,
    });
    await employerRepo.save(empProfile);
  }

  console.log('Seed completed successfully!');
  console.log('--- SEEDED CREDENTIALS ---');
  console.log('Sample Talent 1:', talents[0]);
  console.log('Sample Talent 2:', talents[1]);
  console.log('Sample Talent 22:', talents[21]);
  console.log('Employer:', { email: empEmail, password: 'Password123!' });

  await dataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

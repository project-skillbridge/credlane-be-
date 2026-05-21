import 'reflect-metadata';
import * as argon2 from 'argon2';
import dataSource from '../src/database/data-source';
import { questionBankSeeder } from '../src/database/seeds/question-bank.seeder';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentType,
  VerifiedLevel,
} from '../src/modules/assessments/entities';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../src/modules/talent/entities/talent-profile.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';

const email = process.env.DEV_TALENT_EMAIL ?? 'v4.talent@example.com';
const password = process.env.DEV_TALENT_PASSWORD ?? 'Password@123456';
const track = process.env.DEV_TALENT_TRACK ?? 'frontend_developer';
const level = VerifiedLevel.MID;

async function run(): Promise<void> {
  await dataSource.initialize();

  try {
    await questionBankSeeder.run(dataSource);

    const result = await dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(TalentProfile);
      const attemptRepo = manager.getRepository(AssessmentAttempt);
      const resultRepo = manager.getRepository(AssessmentResult);

      let user = await userRepo.findOne({ where: { email } });
      if (!user) {
        user = userRepo.create({
          email,
          password: await argon2.hash(password),
          first_name: 'V4',
          last_name: 'Talent',
          country: 'Nigeria',
          avatar_url: null,
          is_verified: true,
          onboarding_complete: true,
          role: UserRole.TALENT,
          signup_reason: null,
          refreshTokenHash: null,
        });
      } else {
        user.password = await argon2.hash(password);
        user.is_verified = true;
        user.onboarding_complete = true;
        user.role = UserRole.TALENT;
      }
      user = await userRepo.save(user);

      let profile = await profileRepo.findOne({
        where: { user_id: user.id },
      });
      if (!profile) {
        profile = profileRepo.create({
          user_id: user.id,
          role_track: track,
          role_tracks: [track],
          goal: 'land_first_role',
          region: 'Lagos',
          education_level: 'bachelors',
          linkedin_url: 'https://linkedin.com/in/v4-talent',
          track,
          profile_verified: true,
          claimed_level: level,
          onboarding_step: 3,
          status: TalentProfileStatus.IN_PROGRESS,
          bio: 'Seeded talent account for v4 AI guidance and retake testing.',
          profile_share_link: null,
          is_published: false,
          published_at: null,
          personal_assessment_answers: {
            seeded: true,
            track,
            claimed_level: level,
          },
        });
      }

      profile.role_track = track;
      profile.role_tracks = [track];
      profile.goal = 'land_first_role';
      profile.region = 'Lagos';
      profile.education_level = 'bachelors';
      profile.linkedin_url = 'https://linkedin.com/in/v4-talent';
      profile.track = track;
      profile.profile_verified = true;
      profile.claimed_level = level;
      profile.onboarding_step = 3;
      profile.status = TalentProfileStatus.IN_PROGRESS;
      profile.personal_assessment_answers = {
        ...(profile.personal_assessment_answers ?? {}),
        seeded: true,
        track,
        claimed_level: level,
      };
      profile.personal_assessment_completed_at =
        profile.personal_assessment_completed_at ?? new Date();
      profile.skill_assessment_completed_at =
        profile.skill_assessment_completed_at ?? new Date();
      profile.advanced_assessment_completed_at = null;
      profile.validated_level = level;
      profile.assessment_locked_until = null;
      profile = await profileRepo.save(profile);

      let skillAttempt = await attemptRepo.findOne({
        where: {
          talent_profile_id: profile.id,
          assessment_type: AssessmentType.SKILL,
        },
        order: { completed_at: 'DESC', created_at: 'DESC' },
      });

      if (!skillAttempt) {
        skillAttempt = attemptRepo.create({
          talent_profile_id: profile.id,
          assessment_type: AssessmentType.SKILL,
          started_at: new Date(),
          completed_at: new Date(),
          expires_at: null,
          generated_questions_json: {
            seeded: true,
            context: { verified_level: level },
            questions: [],
          },
        });
      }
      skillAttempt.completed_at = skillAttempt.completed_at ?? new Date();
      skillAttempt.force_submitted = false;
      skillAttempt = await attemptRepo.save(skillAttempt);

      let skillResult = await resultRepo.findOne({
        where: { attempt_id: skillAttempt.id },
      });
      if (!skillResult) {
        skillResult = resultRepo.create({ attempt_id: skillAttempt.id });
      }
      skillResult.score = 8;
      skillResult.max_score = 10;
      skillResult.percentage = 80;
      skillResult.tier = null;
      skillResult.validated_level = level;
      skillResult.guidance_report = null;
      skillResult.integrity_confidence = null;
      await resultRepo.save(skillResult);

      return { user, profile, skillAttempt };
    });

    console.log('V4 prerequisite talent is ready.');
    console.log(`Email: ${result.user.email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID: ${result.user.id}`);
    console.log(`Talent Profile ID: ${result.profile.id}`);
    console.log(`Passing Skill Attempt ID: ${result.skillAttempt.id}`);
    console.log(
      'State: onboarding complete, personal complete, skill 80%, advanced available.',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

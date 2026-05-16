import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../src/modules/talent/entities/talent-profile.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  onboardingComplete: boolean;
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  static nextUser: AuthUser = {
    sub: 'talent-user',
    email: 'talent@example.com',
    role: UserRole.TALENT,
    onboardingComplete: false,
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    request.user = MockJwtAuthGuard.nextUser;
    return true;
  }
}

describe('Dashboard home (e2e)', () => {
  let app: INestApplication<App>;

  const talentUser = makeUser({
    id: 'talent-user',
    first_name: 'Casey',
    role: UserRole.TALENT,
    avatar_url: 'https://cdn.example.com/avatar.png',
    onboarding_complete: true,
  });

  const employerUser = makeUser({
    id: 'employer-user',
    first_name: 'Efe',
    role: UserRole.EMPLOYER,
    onboarding_complete: true,
  });

  const talentProfile = makeProfile({
    user_id: talentUser.id,
    onboarding_step: 3,
    profile_verified: true,
    goal: 'land_first_role',
    track: 'frontend_developer',
    region: 'Lagos',
    education_level: 'bachelors',
    linkedin_url: 'https://linkedin.com/in/casey',
    bio: 'Frontend developer',
    status: TalentProfileStatus.JOB_READY,
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockImplementation((id: string) => {
              if (id === talentUser.id) return Promise.resolve(talentUser);
              if (id === employerUser.id) return Promise.resolve(employerUser);
              return Promise.reject(new Error(`User ${id} not found`));
            }),
          },
        },
        {
          provide: getRepositoryToken(TalentProfile),
          useValue: {
            findOne: jest
              .fn()
              .mockImplementation(
                ({ where }: { where: { user_id: string } }) => {
                  if (where.user_id === talentUser.id)
                    return Promise.resolve(talentProfile);
                  return Promise.resolve(null);
                },
              ),
          },
        },
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: Reflector, useValue: new Reflector() },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/', 'health', 'api', 'api/v1', 'api/docs', 'probe'],
    });
    await app.init();
  });

  it('GET /api/v1/dashboard/home returns the wrapped talent summary', () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboardingComplete: true,
    };

    return request(app.getHttpServer())
      .get('/api/v1/dashboard/home')
      .expect(200)
      .expect((res) => {
        expect(res.body.status_code).toBe(200);
        expect(res.body.message).toBe('success');
        expect(res.body.data).toEqual({
          firstName: 'Casey',
          profileCompletionPercentage: 100,
          journeyOverview: [
            { key: 'onboarding', title: 'Onboarding', status: 'complete' },
            { key: 'assessment_1', title: 'Assessment 1', status: 'active' },
            { key: 'assessment_2', title: 'Assessment 2', status: 'locked' },
            { key: 'assessment_3', title: 'Assessment 3', status: 'locked' },
          ],
        });
      });
  });

  it('GET /api/v1/dashboard/home rejects employers', () => {
    MockJwtAuthGuard.nextUser = {
      sub: employerUser.id,
      email: employerUser.email,
      role: UserRole.EMPLOYER,
      onboardingComplete: true,
    };

    return request(app.getHttpServer())
      .get('/api/v1/dashboard/home')
      .expect(403)
      .expect((res) => {
        expect(res.body.status_code).toBe(403);
        expect(res.body.message).toBe('Insufficient permissions');
      });
  });

  afterEach(async () => {
    if (app) await app.close();
  });
});

function makeUser(overrides: Partial<User>): User {
  return Object.assign(new User(), {
    id: 'user-1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
    country: 'Nigeria',
    is_verified: true,
    onboarding_complete: false,
    role: UserRole.TALENT,
    signup_reason: null,
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

function makeProfile(overrides: Partial<TalentProfile>): TalentProfile {
  return Object.assign(new TalentProfile(), {
    id: 'profile-1',
    user_id: 'user-1',
    role_track: null,
    role_tracks: null,
    goal: null,
    region: null,
    education_level: null,
    linkedin_url: null,
    track: null,
    profile_verified: false,
    onboarding_step: 0,
    status: TalentProfileStatus.NOT_STARTED,
    bio: null,
    profile_share_link: null,
    is_published: false,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

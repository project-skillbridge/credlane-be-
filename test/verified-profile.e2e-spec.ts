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
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { VerifiedProfileController } from '../src/modules/verified-profile/verified-profile.controller';
import { VerifiedProfileService } from '../src/modules/verified-profile/verified-profile.service';

type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  onboarding_complete: boolean;
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  static nextUser: AuthUser = {
    sub: 'talent-user',
    email: 'talent@example.com',
    role: UserRole.TALENT,
    onboarding_complete: true,
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    request.user = MockJwtAuthGuard.nextUser;
    return true;
  }
}

describe('Verified profile (e2e)', () => {
  let app: INestApplication<App>;
  let verifiedProfileService: {
    getForTalentUser: jest.Mock;
    getByShareToken: jest.Mock;
  };

  const verifiedProfilePayload = {
    full_name: 'Alex Smith',
    role: 'Frontend Developer',
    goal: 'Land First Role',
    about: '',
    about_tags: ['Mid Level', 'Job Ready', 'Open to Work', 'Fully Remote'],
    ai_report: 'Alex shows job-ready frontend strengths.',
    avatar_url: null,
    verified: true,
    status: 'job_ready',
    seniority_badge: 'Mid Level',
    tier: 'job_ready',
    skills: ['React', 'TypeScript'],
    tier_label: 'Job Ready',
    score_percentage: 85,
    working_style: ['Async Collaboration', 'Fully Remote'],
    growth_insight: 'Keep deepening systems thinking.',
    recommended_resources: [
      {
        title: 'Frontend Patterns',
        provider: 'SkillBridge',
        url: 'https://example.com/frontend-patterns',
        tier: 'free',
        competency: 'api_design',
        reason: 'Supports frontend architecture growth.',
      },
    ],
    qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200',
    skill_breakdown_tabs: [
      {
        id: 'assessment_scores',
        label: 'Assessment Scores',
        items: [
          {
            id: 'skill_proficiency',
            label: 'Skill Proficiency',
            percentage: 85,
            validated_level: 'mid',
            insight: 'Alex showed job-ready strengths.',
          },
          {
            id: 'workplace_readiness',
            label: 'Workplace Readiness',
            percentage: 0,
            insight: 'Keep deepening systems thinking.',
          },
          {
            id: 'practical_application',
            label: 'Practical Application',
            percentage: 0,
            insight: 'Keep deepening systems thinking.',
          },
        ],
      },
      {
        id: 'professional_skills',
        label: 'Professional Skills',
        items: [{ label: 'Api Design', percentage: 100 }],
      },
      {
        id: 'key_strengths',
        label: 'Strengths',
        items: [
          {
            competency: 'api_design',
            label: 'Api Design',
            percentage: 100,
          },
        ],
      },
    ],
    resource_page_url: '/resources',
    resume_url: 'https://cdn.example.com/resumes/alex.pdf',
    share_url: 'https://skillbridge.com/verified-profiles/'.concat(
      'ab'.repeat(32),
    ),
    is_owner: true,
    verified_at: '2026-05-03T00:00:00.000Z',
  };

  beforeEach(async () => {
    verifiedProfileService = {
      getForTalentUser: jest.fn().mockResolvedValue(verifiedProfilePayload),
      getByShareToken: jest.fn().mockResolvedValue({
        ...verifiedProfilePayload,
        is_owner: false,
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VerifiedProfileController],
      providers: [
        {
          provide: VerifiedProfileService,
          useValue: verifiedProfileService,
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
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

  afterEach(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/talent/verified-profile returns the design-facing verified profile contract', () => {
    MockJwtAuthGuard.nextUser = {
      sub: 'talent-user',
      email: 'talent@example.com',
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    return request(app.getHttpServer())
      .get('/api/v1/talent/verified-profile')
      .expect(200)
      .expect((res) => {
        expect(verifiedProfileService.getForTalentUser).toHaveBeenCalledWith(
          'talent-user',
        );
        expect(res.body.status_code).toBe(200);
        expect(res.body.message).toBe('success');
        expect(res.body.data).toMatchObject({
          full_name: 'Alex Smith',
          role: 'Frontend Developer',
          goal: 'Land First Role',
          ai_report: 'Alex shows job-ready frontend strengths.',
          score_percentage: 85,
          tier_label: 'Job Ready',
          working_style: ['Async Collaboration', 'Fully Remote'],
          growth_insight: 'Keep deepening systems thinking.',
          skill_breakdown_tabs: verifiedProfilePayload.skill_breakdown_tabs,
          recommended_resources: [
            {
              title: 'Frontend Patterns',
              provider: 'SkillBridge',
              tier: 'free',
              competency: 'api_design',
            },
          ],
          resource_page_url: '/resources',
          resume_url: 'https://cdn.example.com/resumes/alex.pdf',
        });
        expect(res.body.data).not.toHaveProperty('ai_summary');
        expect(res.body.data).not.toHaveProperty('detailed_skills');
        expect(res.body.data).not.toHaveProperty('key_strengths');
      });
  });

  it('GET /api/v1/verified-profiles/:token returns public profile fields without owner-only assumptions', () => {
    const token = 'ab'.repeat(32);

    return request(app.getHttpServer())
      .get(`/api/v1/verified-profiles/${token}`)
      .expect(200)
      .expect((res) => {
        expect(verifiedProfileService.getByShareToken).toHaveBeenCalledWith(
          token,
        );
        expect(res.body.data).toMatchObject({
          full_name: 'Alex Smith',
          is_owner: false,
          skill_breakdown_tabs: verifiedProfilePayload.skill_breakdown_tabs,
          recommended_resources: [
            {
              title: 'Frontend Patterns',
              url: 'https://example.com/frontend-patterns',
            },
          ],
        });
        expect(res.body.data).not.toHaveProperty('detailed_skills');
      });
  });
});

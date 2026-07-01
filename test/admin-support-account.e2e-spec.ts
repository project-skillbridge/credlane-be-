import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
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
import { PinoLogger } from 'nestjs-pino';
import { CaseTransformMiddleware } from '../src/common/middleware/case-transform.middleware';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AdminTiersGuard } from '../src/modules/auth/guards/admin-tiers.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { AdminAccountController } from '../src/modules/admin/account/admin-account.controller';
import { AdminAccountService } from '../src/modules/admin/account/admin-account.service';
import { AdminSupportController } from '../src/modules/admin/support/admin-support.controller';
import { AdminSupportService } from '../src/modules/admin/support/admin-support.service';
import { SupportTicketMessage } from '../src/modules/admin/support/entities/support-ticket-message.entity';
import { SupportTicket } from '../src/modules/admin/support/entities/support-ticket.entity';
import {
  SupportTicketStatus,
  SupportTicketType,
} from '../src/modules/admin/support/entities/support-ticket.entity';
import { SupportTicketMessageAuthorType } from '../src/modules/admin/support/entities/support-ticket-message.entity';
import { User, AdminTier, UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  admin_tier: AdminTier | null;
  onboarding_complete: boolean;
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  static nextUser: AuthUser = {
    sub: 'admin-user',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    admin_tier: AdminTier.ADMIN,
    onboarding_complete: true,
  };

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    req.user = MockJwtAuthGuard.nextUser;
    return true;
  }
}

const adminUser = Object.assign(new User(), {
  id: '11111111-1111-4111-8111-111111111111',
  first_name: 'Ava',
  last_name: 'Admin',
  email: 'ava.admin@example.com',
  role: UserRole.ADMIN,
  admin_tier: AdminTier.ADMIN,
  is_active: true,
});

const reviewerUser = Object.assign(new User(), {
  id: '22222222-2222-4222-8222-222222222222',
  first_name: 'Rae',
  last_name: 'Reviewer',
  email: 'rae.reviewer@example.com',
  role: UserRole.ADMIN,
  admin_tier: AdminTier.REVIEWER,
  is_active: true,
});

const submitterUser = Object.assign(new User(), {
  id: '33333333-3333-4333-8333-333333333333',
  first_name: 'Tina',
  last_name: 'Talent',
  email: 'tina@example.com',
  role: UserRole.TALENT,
  admin_tier: null,
  is_active: true,
});

const supportTicket = Object.assign(new SupportTicket(), {
  id: '44444444-4444-4444-8444-444444444444',
  ticket_id: 'TCK-1001',
  submitted_by_user_id: submitterUser.id,
  submitted_by: submitterUser,
  submitter_name: 'Tina Talent',
  submitter_email: 'tina@example.com',
  submitter_role: UserRole.TALENT,
  type: SupportTicketType.TECHNICAL,
  subject: 'Assessment page will not load',
  status: SupportTicketStatus.OPEN,
  assigned_admin_id: adminUser.id,
  assigned_admin: adminUser,
  created_at: new Date('2026-06-30T09:15:00.000Z'),
  updated_at: new Date('2026-06-30T09:20:00.000Z'),
});

const ticketMessages = [
  Object.assign(new SupportTicketMessage(), {
    id: '55555555-5555-4555-8555-555555555555',
    ticket_id: supportTicket.id,
    author_type: SupportTicketMessageAuthorType.SUBMITTER,
    author_user_id: submitterUser.id,
    author: submitterUser,
    author_name: 'Tina Talent',
    body: 'I cannot open the assessment page.',
    created_at: new Date('2026-06-30T09:15:00.000Z'),
  }),
  Object.assign(new SupportTicketMessage(), {
    id: '66666666-6666-4666-8666-666666666666',
    ticket_id: supportTicket.id,
    author_type: SupportTicketMessageAuthorType.ADMIN,
    author_user_id: adminUser.id,
    author: adminUser,
    author_name: 'Ava Admin',
    body: 'I am checking the request logs.',
    created_at: new Date('2026-06-30T09:22:00.000Z'),
  }),
];

const usersById = new Map(
  [adminUser, reviewerUser, submitterUser].map((user) => [user.id, user]),
);

function buildSupportTicketQueryBuilder() {
  const filters: Array<{ clause: string; params?: Record<string, unknown> }> =
    [];
  const qb = {
    filters,
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockImplementation((clause, params) => {
      filters.push({ clause, params });
      return qb;
    }),
    getManyAndCount: jest.fn().mockResolvedValue([[supportTicket], 1]),
  };
  return qb;
}

@Module({})
class TestCaseTransformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CaseTransformMiddleware).forRoutes('*');
  }
}

describe('Admin Support and Account Settings (e2e)', () => {
  let app: INestApplication<App>;
  let supportTicketFindOne: jest.Mock;
  let supportTicketSave: jest.Mock;
  let supportTicketCreateQueryBuilder: jest.Mock;

  beforeEach(async () => {
    MockJwtAuthGuard.nextUser = {
      sub: adminUser.id,
      email: adminUser.email,
      role: UserRole.ADMIN,
      admin_tier: AdminTier.ADMIN,
      onboarding_complete: true,
    };

    supportTicketFindOne = jest
      .fn()
      .mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id !== supportTicket.id) return Promise.resolve(null);
        return Promise.resolve({ ...supportTicket, messages: ticketMessages });
      });
    supportTicketSave = jest.fn((ticket: SupportTicket) =>
      Promise.resolve(ticket),
    );
    supportTicketCreateQueryBuilder = jest.fn(() =>
      buildSupportTicketQueryBuilder(),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestCaseTransformModule],
      controllers: [AdminSupportController, AdminAccountController],
      providers: [
        AdminSupportService,
        AdminAccountService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn((id: string) => {
              const user = usersById.get(id);
              if (!user) return Promise.reject(new Error(`User ${id} not found`));
              return Promise.resolve(user);
            }),
          },
        },
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: {
            createQueryBuilder: supportTicketCreateQueryBuilder,
            findOne: supportTicketFindOne,
            save: supportTicketSave,
          },
        },
        {
          provide: getRepositoryToken(SupportTicketMessage),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(({ where }: { where: { id: string } }) =>
              Promise.resolve(usersById.get(where.id) ?? null),
            ),
          },
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
        { provide: APP_GUARD, useClass: AdminTiersGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: Reflector, useValue: new Reflector() },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('GET /admin/me returns read-only fields for reviewers too', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: reviewerUser.id,
      email: reviewerUser.email,
      role: UserRole.ADMIN,
      admin_tier: AdminTier.REVIEWER,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .expect(200)
      .expect((res) => {
        expect(res.body.status_code).toBe(200);
        expect(res.body.data).toMatchObject({
          id: reviewerUser.id,
          name: 'Rae Reviewer',
          email: 'rae.reviewer@example.com',
          role: UserRole.ADMIN,
          admin_tier: AdminTier.REVIEWER,
          role_badge: 'Reviewer',
        });
        expect(res.body.data.password).toBeUndefined();
      });
  });

  it('GET /admin/support/tickets returns paginated support tickets with filters applied', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/support/tickets')
      .query({
        status: 'open',
        type: 'technical',
        date_from: '2026-06-01',
        date_to: '2026-06-30',
        search: 'Tina',
        page: '1',
        limit: '20',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0]).toMatchObject({
          ticket_id: 'TCK-1001',
          submitted_by: { name: 'Tina Talent' },
          type: 'technical',
          status: 'open',
          assigned_admin: { name: 'Ava Admin' },
        });
      });

    const qb = supportTicketCreateQueryBuilder.mock.results[0].value as ReturnType<
      typeof buildSupportTicketQueryBuilder
    >;
    expect(qb.filters).toEqual(
      expect.arrayContaining([
        { clause: 'ticket.status = :status', params: { status: 'open' } },
        { clause: 'ticket.type = :type', params: { type: 'technical' } },
        {
          clause: 'ticket.created_at >= :dateFrom',
          params: { dateFrom: '2026-06-01' },
        },
        {
          clause: 'ticket.created_at <= :dateTo',
          params: { dateTo: '2026-06-30' },
        },
        {
          clause: 'ticket.submitter_name ILIKE :search',
          params: { search: '%Tina%' },
        },
      ]),
    );
  });

  it('GET /admin/support/tickets/:id returns thread detail', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/support/tickets/${supportTicket.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.thread).toHaveLength(2);
        expect(res.body.data.controls).toEqual({
          available_statuses: ['open', 'in_progress', 'resolved'],
          assignment_enabled: true,
        });
      });
  });

  it('PATCH /admin/support/tickets/:id updates status and assignment', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/support/tickets/${supportTicket.id}`)
      .send({
        status: 'in_progress',
        assigned_admin_id: adminUser.id,
      })
      .expect(200);

    expect(supportTicketSave).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SupportTicketStatus.IN_PROGRESS,
        assigned_admin_id: adminUser.id,
      }),
    );
  });

  it('PATCH /admin/support/tickets/:id rejects reviewer assignment', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/support/tickets/${supportTicket.id}`)
      .send({ assigned_admin_id: reviewerUser.id })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe(
          'Assigned admin must be an active admin user',
        );
      });
  });

  it('returns 404 for a missing support ticket detail', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/support/tickets/77777777-7777-4777-8777-777777777777')
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toBe('Support ticket not found');
      });
  });

  it('returns 403 when reviewer tries to access Support', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: reviewerUser.id,
      email: reviewerUser.email,
      role: UserRole.ADMIN,
      admin_tier: AdminTier.REVIEWER,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .get('/api/v1/admin/support/tickets')
      .expect(403);
  });
});

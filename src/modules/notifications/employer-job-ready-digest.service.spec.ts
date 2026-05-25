import { NotificationType } from './notification-type.enum';
import {
  candidateMatchesEmployerPreferences,
  EmployerJobReadyDigestService,
  hasConfiguredHiringPreferences,
  resolveEmployerHiringRoles,
} from './employer-job-ready-digest.service';
import type { EmployerProfile } from '../employer/entities/employer-profile.entity';

describe('employer job ready digest matching', () => {
  const preferences = {
    hiringRoles: ['frontend_developer'],
    hiringLocations: ['Nigeria'],
    preferredExperienceLevels: ['mid'],
  };

  it('matches role, level, and location', () => {
    expect(
      candidateMatchesEmployerPreferences(preferences, {
        candidateUserId: 'c-1',
        track: 'frontend_developer',
        verifiedLevel: 'mid',
        location: 'Lagos, Nigeria',
        country: 'Nigeria',
      }),
    ).toBe(true);
  });

  it('rejects mismatched track', () => {
    expect(
      candidateMatchesEmployerPreferences(preferences, {
        candidateUserId: 'c-1',
        track: 'backend_developer',
        verifiedLevel: 'mid',
        location: 'Lagos, Nigeria',
        country: 'Nigeria',
      }),
    ).toBe(false);
  });

  it('treats empty hiring locations as any location', () => {
    expect(
      candidateMatchesEmployerPreferences(
        { ...preferences, hiringLocations: [] },
        {
          candidateUserId: 'c-1',
          track: 'frontend_developer',
          verifiedLevel: 'mid',
          location: 'Nairobi',
          country: 'Kenya',
        },
      ),
    ).toBe(true);
  });

  it('accepts remote worldwide preference', () => {
    expect(
      candidateMatchesEmployerPreferences(
        { ...preferences, hiringLocations: ['Remote Worldwide'] },
        {
          candidateUserId: 'c-1',
          track: 'frontend_developer',
          verifiedLevel: 'mid',
          location: 'Berlin',
          country: 'Germany',
        },
      ),
    ).toBe(true);
  });

  it('falls back to desired_roles when hiring_roles is empty', () => {
    const profile = {
      hiring_roles: null,
      desired_roles: ['product_manager'],
    } as EmployerProfile;

    expect(resolveEmployerHiringRoles(profile)).toEqual(['product_manager']);
    expect(hasConfiguredHiringPreferences(profile)).toBe(true);
  });
});

describe('EmployerJobReadyDigestService', () => {
  let service: EmployerJobReadyDigestService;
  let notificationsService: { create: jest.Mock };
  let mailService: { sendJobReadyMatchesDigest: jest.Mock };
  let usersService: { findOneOrNull: jest.Mock };
  let employerProfileRepo: { find: jest.Mock };
  let poolProfileRepo: { createQueryBuilder: jest.Mock };
  let notificationRepo: { createQueryBuilder: jest.Mock };

  const referenceDate = new Date('2026-05-20T12:00:00.000Z');
  const digestWeekStart = new Date(
    referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  beforeEach(() => {
    notificationsService = { create: jest.fn().mockResolvedValue({ id: 'n-1' }) };
    mailService = {
      sendJobReadyMatchesDigest: jest.fn().mockResolvedValue({ id: 'email-1' }),
    };
    usersService = {
      findOneOrNull: jest.fn().mockResolvedValue({
        id: 'emp-1',
        email: 'employer@example.com',
        first_name: 'Acme',
      }),
    };
    employerProfileRepo = { find: jest.fn() };
    notificationRepo = { createQueryBuilder: jest.fn() };

    const poolQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          candidateUserId: 'cand-1',
          track: 'frontend_developer',
          verifiedLevel: 'mid',
          location: 'Lagos',
          country: 'Nigeria',
        },
      ]),
    };
    poolProfileRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(poolQb),
    };

    const dedupeQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    notificationRepo.createQueryBuilder.mockReturnValue(dedupeQb);

    service = new EmployerJobReadyDigestService(
      notificationsService as never,
      mailService as never,
      usersService as never,
      employerProfileRepo as never,
      poolProfileRepo as never,
      notificationRepo as never,
    );
  });

  it('creates one weekly summary notification per employer (not per candidate)', async () => {
    employerProfileRepo.find.mockResolvedValue([
      {
        user_id: 'emp-1',
        hiring_roles: ['frontend_developer'],
        hiring_locations: ['Nigeria'],
        preferred_experience_levels: ['mid'],
        desired_roles: null,
      },
      {
        user_id: 'emp-2',
        hiring_roles: ['backend_developer'],
        hiring_locations: ['Nigeria'],
        preferred_experience_levels: ['mid'],
        desired_roles: null,
      },
    ]);

    await service.processWeeklyDigests(referenceDate);

    expect(notificationsService.create).toHaveBeenCalledTimes(1);
    expect(notificationsService.create).toHaveBeenCalledWith({
      userId: 'emp-1',
      type: NotificationType.JOB_READY_MATCHES_AVAILABLE,
      title: 'New Job Ready candidates match your preferences',
      body: '1 new Job Ready candidate matches your hiring preferences this week.',
      data: {
        digestWeekStart,
        digestWeekEnd: referenceDate.toISOString(),
        matchCount: 1,
        candidateUserIds: ['cand-1'],
      },
    });
    expect(mailService.sendJobReadyMatchesDigest).toHaveBeenCalledTimes(1);
    expect(mailService.sendJobReadyMatchesDigest).toHaveBeenCalledWith({
      to: 'employer@example.com',
      recipientFirstName: 'Acme',
      matchCount: 1,
    });
  });

  it('still creates in-app notification when digest email fails', async () => {
    employerProfileRepo.find.mockResolvedValue([
      {
        user_id: 'emp-1',
        hiring_roles: ['frontend_developer'],
        hiring_locations: ['Nigeria'],
        preferred_experience_levels: ['mid'],
        desired_roles: null,
      },
    ]);
    mailService.sendJobReadyMatchesDigest.mockRejectedValue(
      new Error('smtp down'),
    );

    await service.processWeeklyDigests(referenceDate);

    expect(notificationsService.create).toHaveBeenCalledTimes(1);
  });

  it('skips employers without hiring preferences', async () => {
    employerProfileRepo.find.mockResolvedValue([
      {
        user_id: 'emp-1',
        hiring_roles: null,
        desired_roles: null,
        hiring_locations: [],
        preferred_experience_levels: [],
      },
    ]);

    await service.processWeeklyDigests(referenceDate);

    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('does not duplicate digest for the same week', async () => {
    employerProfileRepo.find.mockResolvedValue([
      {
        user_id: 'emp-1',
        hiring_roles: ['frontend_developer'],
        hiring_locations: ['Nigeria'],
        preferred_experience_levels: ['mid'],
        desired_roles: null,
      },
    ]);

    const dedupeQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    notificationRepo.createQueryBuilder.mockReturnValue(dedupeQb);

    await service.processWeeklyDigests(referenceDate);

    expect(notificationsService.create).not.toHaveBeenCalled();
    expect(mailService.sendJobReadyMatchesDigest).not.toHaveBeenCalled();
  });
});

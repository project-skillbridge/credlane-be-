import { QueryFailedError } from 'typeorm';
import { AssessmentTier } from '../assessments/entities/assessment-result.entity';
import { NotificationType } from './notification-type.enum';
import { NotificationDispatchService } from './notification-dispatch.service';

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let notificationsService: {
    create: jest.Mock;
  };
  let mailService: {
    sendAssessmentPerformance: jest.Mock;
    sendAdvancedRetakeAvailable: jest.Mock;
  };
  let usersService: { findOne: jest.Mock };
  let talentProfileRepo: { find: jest.Mock };

  beforeEach(() => {
    notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'n-1' }),
    };
    mailService = {
      sendAssessmentPerformance: jest.fn().mockResolvedValue({ id: 'email-1' }),
      sendAdvancedRetakeAvailable: jest
        .fn()
        .mockResolvedValue({ id: 'email-2' }),
    };
    usersService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'talent@example.com',
        first_name: 'Jane',
      }),
    };
    talentProfileRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new NotificationDispatchService(
      notificationsService as never,
      mailService as never,
      usersService as never,
      talentProfileRepo as never,
    );
  });

  it('creates in-app notification and sends score-ready email', async () => {
    await service.dispatch(
      NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      'user-1',
      {
        score: 88,
        maxScore: 110,
        percentage: 80,
        tier: AssessmentTier.JOB_READY,
      },
    );

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      }),
    );
    expect(mailService.sendAssessmentPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'talent@example.com',
        percentage: 80,
        tierLabel: 'Job Ready',
      }),
    );
  });

  it('still creates in-app notification when email fails', async () => {
    mailService.sendAssessmentPerformance.mockRejectedValue(
      new Error('smtp down'),
    );

    await service.dispatch(
      NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      'user-1',
      {
        score: 50,
        maxScore: 100,
        percentage: 50,
        tier: AssessmentTier.EMERGING,
      },
    );

    expect(notificationsService.create).toHaveBeenCalled();
  });

  it('sends retake-available in-app and email when the gate has elapsed', async () => {
    const eligibilityDate = new Date('2020-01-15T12:00:00.000Z');

    await service.notifyAdvancedRetakeIfEligible('user-1', {
      advanced_retake_required: true,
      assessment_locked_until: eligibilityDate,
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.ADVANCED_RETAKE_AVAILABLE,
      }),
    );
    expect(mailService.sendAdvancedRetakeAvailable).toHaveBeenCalled();
  });

  it('skips retake notification when insert hits dedupe constraint', async () => {
    notificationsService.create.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate'), { code: '23505' }),
      ),
    );

    await service.dispatch(
      NotificationType.ADVANCED_RETAKE_AVAILABLE,
      'user-1',
      {
        eligibilityDate: '2026-06-01T00:00:00.000Z',
      },
    );

    expect(notificationsService.create).toHaveBeenCalled();
    expect(mailService.sendAdvancedRetakeAvailable).not.toHaveBeenCalled();
  });
});

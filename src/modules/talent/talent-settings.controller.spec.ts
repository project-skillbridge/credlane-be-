import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ErrorMessages } from '../../shared';
import { TalentAvailabilityStatus } from './entities/talent-profile.entity';
import type {
  UpdateCommunicationPreferencesDto,
  UpdateTalentAvailabilityDto,
  UpdateTalentSettingsProfileDto,
} from './dto/settings.dto';
import { TalentSettingsController } from './talent-settings.controller';
import { TalentService } from './talent.service';

describe('TalentSettingsController', () => {
  let controller: TalentSettingsController;
  let talentService: {
    getSettings: jest.Mock;
    updateSettingsProfile: jest.Mock;
    updateResume: jest.Mock;
    updateAvailability: jest.Mock;
    getCommunicationPreferences: jest.Mock;
    updateCommunicationPreferences: jest.Mock;
    unsubscribeEmailNotifications: jest.Mock;
  };

  const userId = 'talent-user-1';

  beforeEach(async () => {
    talentService = {
      getSettings: jest.fn(),
      updateSettingsProfile: jest.fn(),
      updateResume: jest.fn(),
      updateAvailability: jest.fn(),
      getCommunicationPreferences: jest.fn(),
      updateCommunicationPreferences: jest.fn(),
      unsubscribeEmailNotifications: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TalentSettingsController],
      providers: [{ provide: TalentService, useValue: talentService }],
    }).compile();

    controller = moduleRef.get(TalentSettingsController);
  });

  it('uses the talent settings route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TalentSettingsController)).toBe(
      'talent/settings',
    );
  });

  it('maps the expected talent settings handlers', () => {
    expect(Reflect.getMetadata(PATH_METADATA, controller.getSettings)).toBe(
      '/',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.updateSettingsProfile),
    ).toBe('profile');
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.uploadSettingsResume),
    ).toBe('resume');
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.updateSettingsAvailability),
    ).toBe('availability');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        controller.getCommunicationPreferences,
      ),
    ).toBe('communication-preferences');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        controller.updateCommunicationPreferences,
      ),
    ).toBe('communication-preferences');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        controller.unsubscribeEmailNotifications,
      ),
    ).toBe('communication-preferences/email/unsubscribe');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.getSettings)).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.updateSettingsProfile),
    ).toBe(RequestMethod.PATCH);
  });

  it('returns settings data', async () => {
    const serviceResult = {
      user: { id: userId, email: 'talent@example.com' },
      profile: { role_track: 'frontend_developer' },
      communication_preferences: {},
      account: { password_set: true, active_sessions: [] },
    };
    talentService.getSettings.mockResolvedValue(serviceResult);

    const result = await controller.getSettings(userId);

    expect(talentService.getSettings).toHaveBeenCalledWith(userId);
    expect(result).toEqual(serviceResult);
  });

  it('updates settings profile fields', async () => {
    const dto: UpdateTalentSettingsProfileDto = {
      firstName: 'Alex',
      lastName: 'Smith',
      roleTrack: 'frontend_developer',
      linkedinUrl: 'https://www.linkedin.com/in/alexsmith',
      personalWebsite: 'https://alexsmith.dev',
    };
    const serviceResult = {
      status: 'success',
      message: 'Settings profile updated',
    };
    talentService.updateSettingsProfile.mockResolvedValue(serviceResult);

    const result = await controller.updateSettingsProfile(userId, dto);

    expect(talentService.updateSettingsProfile).toHaveBeenCalledWith(
      userId,
      dto,
    );
    expect(result).toEqual(serviceResult);
  });

  it('uploads a resume file', async () => {
    const file = {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf'),
      size: 3,
    } as Express.Multer.File;
    const serviceResult = {
      status: 'success',
      message: 'Resume uploaded',
      resume_url: 'https://cdn.example.com/resume.pdf',
    };
    talentService.updateResume.mockResolvedValue(serviceResult);

    const result = await controller.uploadSettingsResume(userId, file);

    expect(talentService.updateResume).toHaveBeenCalledWith(userId, file);
    expect(result).toEqual(serviceResult);
  });

  it('rejects resume upload when no file is provided', async () => {
    await expect(
      controller.uploadSettingsResume(userId, undefined),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.uploadSettingsResume(userId, undefined),
    ).rejects.toThrow(ErrorMessages.ONBOARDING.NO_FILE);
    expect(talentService.updateResume).not.toHaveBeenCalled();
  });

  it('updates availability', async () => {
    const dto: UpdateTalentAvailabilityDto = {
      availabilityStatus: TalentAvailabilityStatus.ACTIVELY_LOOKING,
    };
    const serviceResult = {
      status: 'success',
      message: 'Availability updated',
      availability_status: TalentAvailabilityStatus.ACTIVELY_LOOKING,
      is_published: true,
    };
    talentService.updateAvailability.mockResolvedValue(serviceResult);

    const result = await controller.updateSettingsAvailability(userId, dto);

    expect(talentService.updateAvailability).toHaveBeenCalledWith(userId, dto);
    expect(result).toEqual(serviceResult);
  });

  it('returns communication preferences in the expected envelope', async () => {
    const preferences = {
      email: {
        new_offers: true,
        assessment_reminders: false,
        retake_window_open: true,
      },
      in_app: {
        new_offers: true,
        assessment_reminders: true,
        retake_window_open: false,
      },
    };
    talentService.getCommunicationPreferences.mockResolvedValue(preferences);

    const result = await controller.getCommunicationPreferences(userId);

    expect(talentService.getCommunicationPreferences).toHaveBeenCalledWith(
      userId,
    );
    expect(result).toEqual({ communication_preferences: preferences });
  });

  it('updates communication preferences', async () => {
    const dto: UpdateCommunicationPreferencesDto = {
      email: {
        newOffers: true,
        assessmentReminders: false,
      },
      inApp: {
        retakeWindowOpen: false,
      },
    };
    const serviceResult = {
      status: 'success',
      message: 'Communication preferences updated',
      communication_preferences: dto,
    };
    talentService.updateCommunicationPreferences.mockResolvedValue(
      serviceResult,
    );

    const result = await controller.updateCommunicationPreferences(userId, dto);

    expect(talentService.updateCommunicationPreferences).toHaveBeenCalledWith(
      userId,
      dto,
    );
    expect(result).toEqual(serviceResult);
  });

  it('unsubscribes from email notifications', async () => {
    const serviceResult = {
      status: 'success',
      message: 'Communication preferences updated',
      communication_preferences: {
        email: {
          new_offers: false,
          assessment_reminders: false,
          retakeWindowOpen: false,
        },
      },
    };
    talentService.unsubscribeEmailNotifications.mockResolvedValue(
      serviceResult,
    );

    const result = await controller.unsubscribeEmailNotifications(userId);

    expect(talentService.unsubscribeEmailNotifications).toHaveBeenCalledWith(
      userId,
    );
    expect(result).toEqual(serviceResult);
  });
});

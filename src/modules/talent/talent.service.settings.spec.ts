import { BadRequestException } from '@nestjs/common';
import {
  TalentAvailabilityStatus,
  TalentProfile,
} from './entities/talent-profile.entity';
import { TalentService } from './talent.service';
import { EmployerPoolProfile } from './entities/employer-pool-profile.entity';

describe('TalentService settings', () => {
  let service: TalentService;
  let manager: {
    transaction: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let talentProfileRepository: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let employerPoolProfileRepository: Record<string, never>;
  let notificationPreferenceRepository: { find: jest.Mock };
  let usersService: { findOne: jest.Mock };

  const userId = 'talent-user-1';

  beforeEach(() => {
    manager = {
      transaction: jest.fn((callback) => callback(manager)),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      create: jest.fn((_entity, payload) => ({ ...payload })),
      save: jest.fn((_entity, payload) =>
        Promise.resolve({ id: 'profile-1', ...payload }),
      ),
    };
    talentProfileRepository = {
      findOne: jest.fn(),
      manager: { transaction: jest.fn((callback) => callback(manager)) },
    };
    employerPoolProfileRepository = {};
    notificationPreferenceRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    usersService = {
      findOne: jest.fn().mockResolvedValue({
        id: userId,
        email: 'talent@example.com',
        first_name: 'Alex',
        last_name: 'Smith',
        fullname: 'Alex Smith',
        avatar_url: null,
        role: 'talent',
      }),
    };

    service = new TalentService(
      talentProfileRepository as never,
      employerPoolProfileRepository as never,
      notificationPreferenceRepository as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
    );
  });

  it('rejects whitespace-only firstName updates', async () => {
    await expect(
      service.updateSettingsProfile(userId, { firstName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only lastName updates', async () => {
    await expect(
      service.updateSettingsProfile(userId, { lastName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manager.update).not.toHaveBeenCalled();
  });

  it('updates first_name and last_name with trimmed values', async () => {
    manager.findOne.mockResolvedValue(
      Object.assign(new TalentProfile(), { user_id: userId }),
    );
    talentProfileRepository.findOne.mockResolvedValue(
      Object.assign(new TalentProfile(), { user_id: userId }),
    );

    await service.updateSettingsProfile(userId, {
      firstName: '  Alex ',
      lastName: ' Smith  ',
    });

    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      { id: userId },
      { first_name: 'Alex', last_name: 'Smith' },
    );
  });

  it('does not update bio via settings profile patch', async () => {
    const profile = Object.assign(new TalentProfile(), {
      user_id: userId,
      bio: 'Original bio from onboarding',
    });
    manager.findOne.mockResolvedValue(profile);
    talentProfileRepository.findOne.mockResolvedValue(profile);

    await service.updateSettingsProfile(userId, {
      linkedinUrl: 'https://www.linkedin.com/in/alexsmith',
    });

    expect(manager.save).toHaveBeenCalledWith(
      TalentProfile,
      expect.objectContaining({
        bio: 'Original bio from onboarding',
        linkedin_url: 'https://www.linkedin.com/in/alexsmith',
      }),
    );
  });

  it('updates availability inside one transaction', async () => {
    const profile = Object.assign(new TalentProfile(), {
      id: 'profile-1',
      user_id: userId,
      availability_status: TalentAvailabilityStatus.OPEN_TO_OPPORTUNITIES,
      is_published: false,
      published_at: null,
    });
    manager.findOne.mockResolvedValue(profile);

    const result = await service.updateAvailability(userId, {
      availabilityStatus: TalentAvailabilityStatus.ACTIVELY_LOOKING,
    });

    expect(talentProfileRepository.manager.transaction).toHaveBeenCalledTimes(
      1,
    );
    expect(manager.save).toHaveBeenCalledWith(
      TalentProfile,
      expect.objectContaining({
        availability_status: TalentAvailabilityStatus.ACTIVELY_LOOKING,
        is_published: true,
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      EmployerPoolProfile,
      { talent_profile_id: 'profile-1' },
      { job_search_status: TalentAvailabilityStatus.ACTIVELY_LOOKING },
    );
    expect(result).toMatchObject({
      status: 'success',
      availability_status: TalentAvailabilityStatus.ACTIVELY_LOOKING,
      is_published: true,
    });
  });

  it('does not save availability when employer pool update fails', async () => {
    manager.findOne.mockResolvedValue(
      Object.assign(new TalentProfile(), {
        id: 'profile-1',
        user_id: userId,
        is_published: true,
      }),
    );
    manager.update.mockRejectedValue(new Error('pool update failed'));

    await expect(
      service.updateAvailability(userId, {
        availabilityStatus: TalentAvailabilityStatus.NOT_LOOKING,
      }),
    ).rejects.toThrow('pool update failed');

    expect(talentProfileRepository.manager.transaction).toHaveBeenCalledTimes(
      1,
    );
  });
});

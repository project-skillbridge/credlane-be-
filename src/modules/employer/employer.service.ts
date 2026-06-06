import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthResult, AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CompleteEmployerOnboardingDto } from './dto/complete-employer-onboarding.dto';
import { SaveEmployerProfileDto } from './dto/save-employer-profile.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { EmployerProfile } from './entities/employer-profile.entity';
import {
  assertRestrictedFieldEditable,
  buildRestrictedFieldsMetadata,
  markRestrictedFieldChanged,
  normalizeCompanyWebsite,
  normalizeLinkedinUrl,
  type EmployerRestrictedFieldsMetadata,
} from './employer-profile-cooldown';
import { EmployerVerificationService } from './employer-verification.service';
import {
  ConflictError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
  SuccessMessages,
} from '../../shared';

export type EmployerPublicProfile = {
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  company_website: string | null;
  linkedin_company_url: string | null;
  region: string | null;
  is_verified: boolean;
  is_new_to_platform: boolean;
  hire_count?: number;
  member_since: string;
};

export type EmployerOnboardingResult = {
  message: string;
  user: AuthResult['data']['user'];
  profile: EmployerProfile;
  tokens: AuthResult['tokens'];
};

export type EmployerProfileResponse = EmployerProfile & {
  restricted_fields: EmployerRestrictedFieldsMetadata;
};

@Injectable()
export class EmployerService {
  private readonly logger = new Logger(EmployerService.name);

  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly verificationService: EmployerVerificationService,
  ) {}

  async getProfile(userId: string): Promise<EmployerProfileResponse> {
    this.verificationService
      .checkAndUpdateVerification(userId)
      .catch((err) =>
        this.logger.error(
          `Verification recompute failed for user ${userId}`,
          err,
        ),
      );

    const profile = await this.employerProfileRepository.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundError('Employer profile not found');
    }
    return this.toProfileResponse(profile);
  }

  async saveProfile(
    userId: string,
    dto: SaveEmployerProfileDto,
  ): Promise<{ status: string; message: string }> {
    await this.employerProfileRepository.manager.transaction(
      async (manager) => {
        let user: User;
        try {
          user = await this.usersService.getUserForOnboarding(manager, userId);
        } catch (error: unknown) {
          if (error instanceof NotFoundException) {
            throw new ForbiddenError(ErrorMessages.ONBOARDING.INVALID_USER);
          }
          throw error;
        }
        if (user.onboarding_complete) {
          throw new ForbiddenError(ErrorMessages.ONBOARDING.ALREADY_COMPLETED);
        }

        let profile = await manager.findOne(EmployerProfile, {
          where: { user_id: userId },
        });
        if (!profile) {
          profile = manager.create(EmployerProfile, { user_id: userId });
        }

        profile.employer_type = dto.employerType;
        profile.company_name = dto.companyName.trim();
        profile.company_size = dto.companySize;
        profile.company_website = dto.companyWebsite.trim();
        profile.website_url = dto.companyWebsite.trim();
        profile.industry = dto.industry.trim();
        profile.region = dto.region.trim();
        profile.hiring_region = dto.region.trim();
        if (dto.linkedinCompanyPageUrl !== undefined) {
          const linkedinCompanyPageUrl = dto.linkedinCompanyPageUrl.trim();
          if (linkedinCompanyPageUrl !== '') {
            profile.linkedin_company_page_url = linkedinCompanyPageUrl;
            profile.linkedin_company_url = linkedinCompanyPageUrl;
          }
        }
        profile.hiring_roles = dto.hiringRoles;
        profile.hiring_locations = [dto.region.trim()];
        profile.desired_roles = dto.hiringRoles;
        profile.preferred_experience_levels = dto.preferredExperienceLevels;
        profile.hiring_count_range = dto.hiringCount ?? null;

        await manager.save(EmployerProfile, profile);
        await this.usersService.markOnboardingCompleteWithManager(
          manager,
          userId,
        );
      },
    );

    // Recompute verification status after profile changes (non-blocking)
    this.verificationService
      .checkAndUpdateVerification(userId)
      .catch((err) =>
        this.logger.error(
          `Verification recompute failed for user ${userId}`,
          err,
        ),
      );

    return {
      status: 'success',
      message: SuccessMessages.ONBOARDING.EMPLOYER_PROFILE_SAVED,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateEmployerProfileDto,
  ): Promise<{
    status: string;
    message: string;
    profile: EmployerProfileResponse;
  }> {
    const profile = await this.employerProfileRepository.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundError('Employer profile not found');
    }

    this.applyProfileUpdates(profile, dto);
    const savedProfile = await this.employerProfileRepository.manager.save(
      EmployerProfile,
      profile,
    );

    this.verificationService
      .checkAndUpdateVerification(userId)
      .catch((err) =>
        this.logger.error(
          `Verification recompute failed for user ${userId}`,
          err,
        ),
      );

    return {
      status: 'success',
      message: 'Employer profile updated',
      profile: this.toProfileResponse(savedProfile),
    };
  }

  private applyProfileUpdates(
    profile: EmployerProfile,
    dto: UpdateEmployerProfileDto,
  ): void {
    const now = new Date();

    if (dto.employerType !== undefined) {
      profile.employer_type = dto.employerType;
    }
    if (dto.companyName !== undefined) {
      const companyName = this.trimNonEmpty(dto.companyName);
      if (companyName && companyName !== profile.company_name?.trim()) {
        assertRestrictedFieldEditable(profile, 'company_name', now);
        profile.company_name = companyName;
        markRestrictedFieldChanged(profile, 'company_name', now);
      }
    }
    if (dto.companySize !== undefined) {
      profile.company_size = dto.companySize;
    }
    if (dto.companyWebsite !== undefined) {
      const companyWebsite = this.trimNonEmpty(dto.companyWebsite);
      if (
        companyWebsite &&
        companyWebsite !== normalizeCompanyWebsite(profile)
      ) {
        assertRestrictedFieldEditable(profile, 'company_website', now);
        profile.company_website = companyWebsite;
        profile.website_url = companyWebsite;
        markRestrictedFieldChanged(profile, 'company_website', now);
      }
    }
    if (dto.industry !== undefined) {
      const industry = this.trimNonEmpty(dto.industry);
      if (industry) {
        profile.industry = industry;
      }
    }
    if (dto.region !== undefined) {
      const region = this.trimNonEmpty(dto.region);
      if (region) {
        profile.region = region;
        profile.hiring_region = region;
        profile.hiring_locations = [region];
      }
    }
    if (dto.linkedinCompanyPageUrl !== undefined) {
      const nextLinkedin = dto.linkedinCompanyPageUrl?.trim() || null;
      if (nextLinkedin !== normalizeLinkedinUrl(profile)) {
        assertRestrictedFieldEditable(profile, 'linkedin_url', now);
        profile.linkedin_company_page_url = nextLinkedin;
        profile.linkedin_company_url = nextLinkedin;
        markRestrictedFieldChanged(profile, 'linkedin_url', now);
      }
    }
    if (dto.hiringRoles !== undefined) {
      profile.hiring_roles = dto.hiringRoles;
      profile.desired_roles = dto.hiringRoles;
    }
    if (dto.preferredExperienceLevels !== undefined) {
      profile.preferred_experience_levels = dto.preferredExperienceLevels;
    }
    if (dto.hiringCount !== undefined) {
      profile.hiring_count_range = dto.hiringCount ?? null;
    }
  }

  private toProfileResponse(profile: EmployerProfile): EmployerProfileResponse {
    return {
      ...profile,
      restricted_fields: buildRestrictedFieldsMetadata(profile),
    };
  }

  private trimNonEmpty(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  async completeOnboarding(
    userId: string,
    dto: CompleteEmployerOnboardingDto,
  ): Promise<EmployerOnboardingResult> {
    const profile = await this.employerProfileRepository.manager.transaction(
      async (manager) => {
        let user: User;
        try {
          user = await this.usersService.getUserForOnboarding(manager, userId);
        } catch (error: unknown) {
          if (error instanceof NotFoundException) {
            throw new ForbiddenError(ErrorMessages.ONBOARDING.INVALID_USER);
          }
          throw error;
        }
        if (user.onboarding_complete) {
          throw new ForbiddenError(ErrorMessages.ONBOARDING.ALREADY_COMPLETED);
        }

        const existingProfile = await manager.findOne(EmployerProfile, {
          where: { user_id: userId },
        });
        if (existingProfile) {
          throw new ConflictError(
            ErrorMessages.ONBOARDING.EMPLOYER_PROFILE_EXISTS,
          );
        }

        const companyWebsite = dto.companyWebsite.trim();
        const nextProfile = manager.create(EmployerProfile, {
          user_id: userId,
          employer_type: dto.joiningAs,
          joining_as: dto.joiningAs,
          company_name: dto.companyName?.trim() || null,
          company_size: dto.companySize ?? null,
          industry: dto.industry?.trim() || null,
          desired_roles: dto.desiredRoles,
          hiring_roles: dto.desiredRoles,
          hiring_locations: [dto.region.trim()],
          region: dto.region.trim(),
          hiring_region: dto.region.trim(),
          hiring_count_range: dto.hiringCountRange ?? null,
          company_website: companyWebsite,
          website_url: companyWebsite,
          linkedin_company_page_url: dto.linkedinCompanyPageUrl?.trim() || null,
          linkedin_company_url: dto.linkedinCompanyPageUrl?.trim() || null,
          preferred_experience_levels: dto.preferredExperienceLevels ?? null,
        });

        const savedProfile = await manager.save(EmployerProfile, nextProfile);
        await this.usersService.markOnboardingCompleteWithManager(
          manager,
          userId,
        );

        return savedProfile;
      },
    );

    const session = await this.authService.issueSessionForUser(
      userId,
      SuccessMessages.ONBOARDING.EMPLOYER_COMPLETED,
    );

    // Recompute verification after onboarding (non-blocking)
    this.verificationService
      .checkAndUpdateVerification(userId)
      .catch((err) =>
        this.logger.error(
          `Verification recompute failed for user ${userId}`,
          err,
        ),
      );

    return {
      message: session.message,
      user: session.data.user,
      profile,
      tokens: session.tokens,
    };
  }

  async getPublicProfile(
    employerUserId: string,
  ): Promise<EmployerPublicProfile> {
    const profile = await this.employerProfileRepository.findOne({
      where: { user_id: employerUserId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundError('Employer profile not found');
    }

    const createdAt = new Date(profile.user.createdAt);
    const accountAge = Date.now() - createdAt.getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const is_new_to_platform =
      accountAge < ninetyDaysMs && profile.hire_count === 0;

    return {
      company_name: profile.company_name,
      industry: profile.industry,
      company_size: profile.company_size,
      company_website: normalizeCompanyWebsite(profile),
      linkedin_company_url: normalizeLinkedinUrl(profile),
      region: profile.region ?? profile.hiring_region ?? null,
      is_verified: profile.is_verified,
      is_new_to_platform,
      ...(profile.hire_count > 0 ? { hire_count: profile.hire_count } : {}),
      member_since: createdAt.toISOString(),
    };
  }
}

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
  hire_count: number;
  member_since: string;
};

export type EmployerOnboardingResult = {
  message: string;
  user: AuthResult['data']['user'];
  profile: EmployerProfile;
  tokens: AuthResult['tokens'];
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

  async getProfile(userId: string): Promise<EmployerProfile> {
    const profile = await this.employerProfileRepository.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundError('Employer profile not found');
    }
    return profile;
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

        profile.employer_type = dto.employer_type;
        profile.company_name = dto.company_name.trim();
        profile.company_size = dto.company_size;
        profile.company_website = dto.company_website.trim();
        profile.website_url = dto.company_website.trim();
        profile.industry = dto.industry.trim();
        profile.region = dto.region.trim();
        profile.hiring_region = dto.region.trim();
        profile.linkedin_company_page_url =
          dto.linkedin_company_page_url?.trim() ?? null;
        profile.linkedin_company_url =
          dto.linkedin_company_page_url?.trim() ?? null;
        profile.hiring_roles = dto.hiring_roles;
        profile.hiring_locations = [dto.region.trim()];
        profile.desired_roles = dto.hiring_roles;
        profile.preferred_experience_levels = dto.preferred_experience_levels;
        profile.hiring_count_range = dto.hiring_count ?? null;

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
  ): Promise<{ status: string; message: string; profile: EmployerProfile }> {
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
      profile: savedProfile,
    };
  }

  private applyProfileUpdates(
    profile: EmployerProfile,
    dto: UpdateEmployerProfileDto,
  ): void {
    if (dto.employer_type !== undefined) {
      profile.employer_type = dto.employer_type;
    }
    if (dto.company_name !== undefined) {
      const companyName = this.trimNonEmpty(dto.company_name);
      if (companyName) {
        profile.company_name = companyName;
      }
    }
    if (dto.company_size !== undefined) {
      profile.company_size = dto.company_size;
    }
    if (dto.company_website !== undefined) {
      const companyWebsite = this.trimNonEmpty(dto.company_website);
      if (companyWebsite) {
        profile.company_website = companyWebsite;
        profile.website_url = companyWebsite;
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
    if (dto.linkedin_company_page_url !== undefined) {
      profile.linkedin_company_page_url =
        dto.linkedin_company_page_url?.trim() ?? null;
      profile.linkedin_company_url =
        dto.linkedin_company_page_url?.trim() ?? null;
    }
    if (dto.hiring_roles !== undefined) {
      profile.hiring_roles = dto.hiring_roles;
      profile.desired_roles = dto.hiring_roles;
    }
    if (dto.preferred_experience_levels !== undefined) {
      profile.preferred_experience_levels = dto.preferred_experience_levels;
    }
    if (dto.hiring_count !== undefined) {
      profile.hiring_count_range = dto.hiring_count ?? null;
    }
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

        const nextProfile = manager.create(EmployerProfile, {
          user_id: userId,
          employer_type: dto.joining_as,
          joining_as: dto.joining_as,
          company_name: dto.company_name.trim(),
          company_size: dto.company_size,
          industry: dto.industry.trim(),
          desired_roles: dto.desired_roles,
          hiring_roles: dto.desired_roles,
          hiring_locations: [dto.region.trim()],
          region: dto.region.trim(),
          hiring_region: dto.region.trim(),
          hiring_count_range: dto.hiring_count_range,
          company_website: dto.company_website?.trim() || null,
          website_url: dto.company_website?.trim() || null,
          linkedin_company_page_url:
            dto.linkedin_company_page_url?.trim() || null,
          linkedin_company_url: dto.linkedin_company_page_url?.trim() || null,
          preferred_experience_levels: dto.preferred_experience_levels,
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

    const accountAge = Date.now() - new Date(profile.user.createdAt).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const is_new_to_platform =
      accountAge < ninetyDaysMs && profile.hire_count === 0;

    return {
      company_name: profile.company_name,
      industry: profile.industry,
      company_size: profile.company_size,
      company_website: profile.company_website ?? profile.website_url,
      linkedin_company_url:
        profile.linkedin_company_page_url ?? profile.linkedin_company_url,
      region: profile.region ?? profile.hiring_region,
      is_verified: profile.is_verified,
      is_new_to_platform,
      hire_count: profile.hire_count,
      member_since: profile.user.createdAt.toISOString(),
    };
  }
}

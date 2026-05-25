import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthResult, AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CompleteEmployerOnboardingDto } from './dto/complete-employer-onboarding.dto';
import { SaveEmployerProfileDto } from './dto/save-employer-profile.dto';
import { EmployerProfile } from './entities/employer-profile.entity';
import { EmployerVerificationService } from './employer-verification.service';
import {
  ConflictError,
  ErrorMessages,
  ForbiddenError,
  SuccessMessages,
} from '../../shared';

export type EmployerOnboardingResult = {
  message: string;
  user: AuthResult['data']['user'];
  profile: EmployerProfile;
  tokens: AuthResult['tokens'];
};

@Injectable()
export class EmployerService {
  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly verificationService: EmployerVerificationService,
  ) {}

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
        profile.linkedin_company_page_url =
          dto.linkedinCompanyPageUrl?.trim() ?? null;
        profile.linkedin_company_url =
          dto.linkedinCompanyPageUrl?.trim() ?? null;
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
    this.verificationService.checkAndUpdateVerification(userId).catch(() => {});

    return {
      status: 'success',
      message: SuccessMessages.ONBOARDING.EMPLOYER_PROFILE_SAVED,
    };
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
          employer_type: dto.joiningAs,
          joining_as: dto.joiningAs,
          company_name: dto.companyName.trim(),
          company_size: dto.companySize,
          industry: dto.industry.trim(),
          desired_roles: dto.desiredRoles,
          hiring_roles: dto.desiredRoles,
          hiring_locations: [dto.region.trim()],
          region: dto.region.trim(),
          hiring_region: dto.region.trim(),
          hiring_count_range: dto.hiringCountRange,
          company_website: dto.companyWebsite?.trim() || null,
          website_url: dto.companyWebsite?.trim() || null,
          linkedin_company_page_url: dto.linkedinCompanyPageUrl?.trim() || null,
          linkedin_company_url: dto.linkedinCompanyPageUrl?.trim() || null,
          preferred_experience_levels: dto.preferredExperienceLevels,
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
    this.verificationService.checkAndUpdateVerification(userId).catch(() => {});

    return {
      message: session.message,
      user: session.data.user,
      profile,
      tokens: session.tokens,
    };
  }
}

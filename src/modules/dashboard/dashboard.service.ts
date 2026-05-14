import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorMessages, ForbiddenError } from '../../shared';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  DashboardHomeResponse,
  DashboardJourneyStatus,
  JourneyOverviewItemDto,
} from './dto/dashboard-home.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
  ) {}

  async getHome(userId: string): Promise<DashboardHomeResponse> {
    const user = await this.usersService.findOne(userId);

    if (user.role !== UserRole.TALENT) {
      throw new ForbiddenError(ErrorMessages.COMMON.INSUFFICIENT_PERMISSIONS);
    }

    const profile = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });

    const onboardingComplete = this.isOnboardingComplete(user, profile);

    return {
      firstName: user.first_name,
      profileCompletionPercentage: this.calculateProfileCompletion(
        user,
        profile,
        onboardingComplete,
      ),
      journeyOverview: this.buildJourneyOverview(onboardingComplete),
    };
  }

  private isOnboardingComplete(
    user: User,
    profile: TalentProfile | null,
  ): boolean {
    return Boolean(
      user.onboarding_complete ||
      profile?.profile_verified ||
      (profile?.onboarding_step ?? 0) >= 3 ||
      profile?.status === TalentProfileStatus.JOB_READY,
    );
  }

  private calculateProfileCompletion(
    user: User,
    profile: TalentProfile | null,
    onboardingComplete: boolean,
  ): number {
    if (onboardingComplete) {
      return 100;
    }

    if (!profile) {
      return 0;
    }

    const stepScores = [0, 20, 40, 60];
    const onboardingStep = Math.max(
      0,
      Math.min(profile.onboarding_step ?? 0, 3),
    );
    const onboardingStepScore = stepScores[onboardingStep] ?? 0;

    const additionalScore =
      (user.avatar_url ? 4 : 0) +
      (this.hasAnyText(
        profile.goal,
        profile.track,
        profile.role_track,
        ...(profile.role_tracks ?? []),
      )
        ? 8
        : 0) +
      (profile.region?.trim() ? 8 : 0) +
      (profile.education_level?.trim() ? 8 : 0) +
      (profile.linkedin_url?.trim() || profile.bio?.trim() ? 8 : 0) +
      (profile.profile_verified ? 10 : 0);

    return Math.min(100, onboardingStepScore + additionalScore);
  }

  private buildJourneyOverview(
    onboardingComplete: boolean,
  ): JourneyOverviewItemDto[] {
    return [
      {
        key: 'onboarding',
        title: 'Onboarding',
        status: onboardingComplete
          ? DashboardJourneyStatus.COMPLETE
          : DashboardJourneyStatus.ACTIVE,
      },
      {
        key: 'assessment_1',
        title: 'Assessment 1',
        status: onboardingComplete
          ? DashboardJourneyStatus.ACTIVE
          : DashboardJourneyStatus.LOCKED,
      },
      {
        key: 'assessment_2',
        title: 'Assessment 2',
        status: DashboardJourneyStatus.LOCKED,
      },
      {
        key: 'assessment_3',
        title: 'Assessment 3',
        status: DashboardJourneyStatus.LOCKED,
      },
    ];
  }

  private hasAnyText(...values: Array<string | null | undefined>): boolean {
    return values.some((value) => Boolean(value?.trim()));
  }
}

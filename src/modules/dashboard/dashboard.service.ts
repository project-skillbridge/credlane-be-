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
import { DASHBOARD_PROFILE_COMPLETENESS_CONFIG } from './dashboard-profile-completeness.config';
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
      profileCompletionPercentage: this.calculateProfileCompletion(user, profile),
      journeyOverview: this.buildJourneyOverview(onboardingComplete),
    };
  }

  private isOnboardingComplete(
    user: User,
    profile: TalentProfile | null,
  ): boolean {
    return Boolean(
      user.onboarding_complete ||
      (profile?.onboarding_step ?? 0) >= 3 ||
      profile?.status === TalentProfileStatus.JOB_READY,
    );
  }

  private calculateProfileCompletion(
    user: User,
    profile: TalentProfile | null,
  ): number {
    if (!profile) {
      return 0;
    }

    const onboardingStep = Math.max(
      0,
      Math.min(profile.onboarding_step ?? 0, 3),
    );
    const onboardingStepScore =
      DASHBOARD_PROFILE_COMPLETENESS_CONFIG.onboardingStepScores[onboardingStep] ?? 0;

    const additionalScore = DASHBOARD_PROFILE_COMPLETENESS_CONFIG.rules.reduce(
      (total, rule) =>
        total +
        (rule.isFilled({ user, profile }) ? rule.weight : 0),
      0,
    );

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
}

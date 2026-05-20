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
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentType,
} from '../assessments/entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepository: Repository<AssessmentResult>,
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
    const assessmentStatuses = await this.getAssessmentStatuses(profile);
    return {
      firstName: user.first_name,
      profileCompletionPercentage: this.calculateProfileCompletion(
        user,
        profile,
      ),
      journeyOverview: this.buildJourneyOverview(
        onboardingComplete,
        assessmentStatuses,
      ),
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
      DASHBOARD_PROFILE_COMPLETENESS_CONFIG.onboardingStepScores[
        onboardingStep
      ] ?? 0;

    const additionalScore = DASHBOARD_PROFILE_COMPLETENESS_CONFIG.rules.reduce(
      (total, rule) =>
        total + (rule.isFilled({ user, profile }) ? rule.weight : 0),
      0,
    );

    return Math.min(100, onboardingStepScore + additionalScore);
  }

  private buildJourneyOverview(
    onboardingComplete: boolean,
    statuses: {
      personal: DashboardJourneyStatus;
      skill: DashboardJourneyStatus;
      advanced: DashboardJourneyStatus;
    },
  ): JourneyOverviewItemDto[] {
    return [
      {
        key: 'onboarding',
        title: 'Onboarding',
        status: onboardingComplete
          ? DashboardJourneyStatus.COMPLETED
          : DashboardJourneyStatus.AVAILABLE,
      },
      {
        key: 'personal',
        title: 'Personal Assessment',
        status: statuses.personal,
      },
      {
        key: 'skill',
        title: 'Skill Assessment',
        status: statuses.skill,
      },
      {
        key: 'advanced',
        title: 'Advanced Assessment',
        status: statuses.advanced,
      },
    ];
  }

  private async getLatestResult(
    talentProfileId: string,
    assessmentType: AssessmentType,
  ): Promise<AssessmentResult | null> {
    return this.assessmentResultRepository
      .createQueryBuilder('result')
      .innerJoin(AssessmentAttempt, 'attempt', 'attempt.id = result.attempt_id')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType,
      })
      .orderBy('attempt.completed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();
  }

  private async getAssessmentStatuses(profile: TalentProfile | null): Promise<{
    personal: DashboardJourneyStatus;
    skill: DashboardJourneyStatus;
    advanced: DashboardJourneyStatus;
  }> {
    if (!profile) {
      return {
        personal: DashboardJourneyStatus.LOCKED,
        skill: DashboardJourneyStatus.LOCKED,
        advanced: DashboardJourneyStatus.LOCKED,
      };
    }

    const personalStatus = profile.personal_assessment_completed_at
      ? DashboardJourneyStatus.COMPLETED
      : this.canStartPersonalAssessment(profile)
        ? DashboardJourneyStatus.AVAILABLE
        : DashboardJourneyStatus.LOCKED;

    let skillStatus: DashboardJourneyStatus;
    if (profile.skill_assessment_completed_at) {
      skillStatus = DashboardJourneyStatus.COMPLETED;
    } else if (!this.canStartSkillAssessment(profile)) {
      skillStatus = DashboardJourneyStatus.LOCKED;
    } else if (
      profile.assessment_locked_until &&
      profile.assessment_locked_until > new Date()
    ) {
      skillStatus = DashboardJourneyStatus.LOCKED;
    } else {
      skillStatus = DashboardJourneyStatus.AVAILABLE;
    }

    let advancedStatus: DashboardJourneyStatus;
    if (profile.advanced_assessment_completed_at) {
      advancedStatus = DashboardJourneyStatus.COMPLETED;
    } else if (!this.canStartAdvancedAssessment(profile)) {
      advancedStatus = DashboardJourneyStatus.LOCKED;
    } else if (
      profile.assessment_locked_until &&
      profile.assessment_locked_until > new Date()
    ) {
      advancedStatus = DashboardJourneyStatus.LOCKED;
    } else {
      const latestSkillResult = await this.getLatestResult(
        profile.id,
        AssessmentType.SKILL,
      );
      const skillPass = (latestSkillResult?.percentage ?? 0) >= 75;
      advancedStatus = skillPass
        ? DashboardJourneyStatus.AVAILABLE
        : DashboardJourneyStatus.LOCKED;
    }

    return {
      personal: personalStatus,
      skill: skillStatus,
      advanced: advancedStatus,
    };
  }

  private canStartPersonalAssessment(profile: TalentProfile): boolean {
    return Boolean(
      profile.track?.trim() &&
      profile.education_level?.trim() &&
      profile.region?.trim(),
    );
  }

  private canStartSkillAssessment(profile: TalentProfile): boolean {
    return Boolean(
      profile.personal_assessment_completed_at &&
      profile.claimed_level &&
      profile.track?.trim(),
    );
  }

  private canStartAdvancedAssessment(profile: TalentProfile): boolean {
    return Boolean(
      profile.personal_assessment_completed_at &&
      profile.skill_assessment_completed_at &&
      profile.validated_level,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ErrorMessages, ForbiddenError } from '../../shared';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { DASHBOARD_PROFILE_COMPLETENESS_CONFIG } from './dashboard-profile-completeness.config';
import {
  DashboardAdvancedPerformance,
  DashboardHomeResponse,
  DashboardJourneyStatus,
  DashboardPerformance,
  DashboardRetake,
  DashboardSkillPerformance,
  JourneyOverviewItemDto,
} from './dto/dashboard-home.dto';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
} from '../assessments/entities';
import { VerifiedLevel } from '../assessments/entities/assessment-question.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import {
  SKILL_ASSESSMENT_MAX_ATTEMPTS,
  SKILL_ASSESSMENT_PASS_PERCENTAGE,
} from '../talent/talent.constants';
import {
  meetsSkillQualityBenchmark,
  qualifiesForAdvancedFromSkillResult,
} from '../talent/assessment/assessment-quality';

const ADVANCED_RETAKE_GATE_DAYS = 14;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepository: Repository<AssessmentResult>,
    @InjectRepository(AssessmentAttempt)
    private readonly assessmentAttemptRepository: Repository<AssessmentAttempt>,
    private readonly notificationDispatch: NotificationDispatchService,
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
    const performance = await this.buildPerformance(profile);

    void this.notificationDispatch.notifyAdvancedRetakeIfEligible(
      userId,
      profile,
    );

    return {
      firstName: user.first_name,
      avatarUrl: user.avatar_url,
      goal: profile?.goal ?? null,
      profileCompletionPercentage: this.calculateProfileCompletion(
        user,
        profile,
      ),
      journeyOverview: this.buildJourneyOverview(
        onboardingComplete,
        assessmentStatuses,
      ),
      performance,
      skillAttemptsUsed: assessmentStatuses.completedSkillAttempts,
      skillMaxAttempts: SKILL_ASSESSMENT_MAX_ATTEMPTS,
      ...this.withAdvancedRetake(profile),
    };
  }

  private async buildPerformance(
    profile: TalentProfile | null,
  ): Promise<DashboardPerformance> {
    if (!profile) {
      return { skill: null, advanced: null };
    }

    const [skillResult, advancedResult, skillAttemptsUsed] = await Promise.all([
      this.getLatestResult(profile.id, AssessmentType.SKILL),
      this.getLatestResult(profile.id, AssessmentType.ADVANCED),
      this.assessmentAttemptRepository.count({
        where: {
          talent_profile_id: profile.id,
          assessment_type: AssessmentType.SKILL,
          completed_at: Not(IsNull()),
        },
      }),
    ]);

    return {
      skill: skillResult
        ? this.toSkillPerformance(skillResult, profile, skillAttemptsUsed)
        : null,
      advanced: advancedResult
        ? this.toAdvancedPerformance(advancedResult, profile)
        : null,
    };
  }

  private toSkillPerformance(
    result: AssessmentResult,
    profile: TalentProfile,
    attemptsUsed: number,
  ): DashboardSkillPerformance {
    const percentage = result.percentage ?? 0;
    const claimedPercentage = result.claimed_percentage ?? percentage;
    const validatedLevel =
      result.validated_level ?? profile.validated_level ?? VerifiedLevel.JUNIOR;

    const failed = !meetsSkillQualityBenchmark(percentage);

    return {
      score: result.score,
      maxScore: result.max_score ?? result.score,
      percentage,
      validatedLevel,
      passed: !failed && claimedPercentage >= SKILL_ASSESSMENT_PASS_PERCENTAGE,
      failed,
      completedAt: this.toIsoTimestamp(
        profile.skill_assessment_completed_at,
        result.created_at,
      ),
      attemptsUsed,
      attemptsRemaining: Math.max(
        0,
        SKILL_ASSESSMENT_MAX_ATTEMPTS - attemptsUsed,
      ),
      ...(result.guidance_report != null && {
        guidanceReport: result.guidance_report,
      }),
    };
  }

  private toAdvancedPerformance(
    result: AssessmentResult,
    profile: TalentProfile,
  ): DashboardAdvancedPerformance {
    const percentage = result.percentage ?? 0;
    const tier = result.tier ?? this.resolveTierFromPercentage(percentage);

    return {
      score: result.score,
      maxScore: result.max_score ?? result.score,
      percentage,
      tier,
      tierLabel: this.formatTierLabel(tier),
      integrityConfidence: result.integrity_confidence ?? 'high',
      completedAt: this.toIsoTimestamp(
        profile.advanced_assessment_completed_at,
        result.created_at,
      ),
      ...(result.guidance_report != null && {
        guidanceReport: result.guidance_report,
      }),
      ...this.withNestedRetake(profile),
    };
  }

  private withAdvancedRetake(profile: TalentProfile | null): {
    advancedRetake?: DashboardRetake;
  } {
    const retake = this.buildAdvancedRetake(profile);
    return retake ? { advancedRetake: retake } : {};
  }

  private withNestedRetake(profile: TalentProfile): {
    retake?: DashboardRetake;
  } {
    const retake = this.buildAdvancedRetake(profile);
    return retake ? { retake } : {};
  }

  private buildAdvancedRetake(
    profile: TalentProfile | null,
  ): DashboardRetake | null {
    if (
      !profile?.advanced_retake_required ||
      !profile.assessment_locked_until
    ) {
      return null;
    }

    const now = Date.now();
    const eligibilityTime = profile.assessment_locked_until.getTime();
    const probationStartedAt =
      profile.assessment_locked_from ??
      new Date(
        eligibilityTime - ADVANCED_RETAKE_GATE_DAYS * 24 * 60 * 60 * 1000,
      );
    const countdownSeconds = Math.max(
      0,
      Math.ceil((eligibilityTime - now) / 1000),
    );

    return {
      probationStartDate: probationStartedAt.toISOString(),
      probationEndDate: profile.assessment_locked_until.toISOString(),
      eligibilityDate: profile.assessment_locked_until.toISOString(),
      ctaEnabled: countdownSeconds === 0,
      countdownSeconds,
      daysRemaining:
        countdownSeconds === 0
          ? 0
          : Math.ceil(countdownSeconds / (24 * 60 * 60)),
    };
  }

  private resolveTierFromPercentage(percentage: number): AssessmentTier {
    if (percentage >= 75) return AssessmentTier.JOB_READY;
    if (percentage >= 50) return AssessmentTier.EMERGING;
    return AssessmentTier.NOT_READY;
  }

  private formatTierLabel(tier: AssessmentTier): string {
    switch (tier) {
      case AssessmentTier.JOB_READY:
        return 'Job Ready';
      case AssessmentTier.EMERGING:
        return 'Emerging';
      default:
        return 'Not Ready';
    }
  }

  private toIsoTimestamp(
    profileCompletedAt: Date | null,
    resultCreatedAt: Date,
  ): string {
    return (profileCompletedAt ?? resultCreatedAt).toISOString();
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

    if (this.isOnboardingComplete(user, profile)) {
      return 100;
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

  private countCompletedSkillAttempts(
    talentProfileId: string,
  ): Promise<number> {
    return this.assessmentAttemptRepository.count({
      where: {
        talent_profile_id: talentProfileId,
        assessment_type: AssessmentType.SKILL,
        completed_at: Not(IsNull()),
      },
    });
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
    completedSkillAttempts: number;
  }> {
    if (!profile) {
      return {
        personal: DashboardJourneyStatus.LOCKED,
        skill: DashboardJourneyStatus.LOCKED,
        advanced: DashboardJourneyStatus.LOCKED,
        completedSkillAttempts: 0,
      };
    }

    const personalStatus = profile.personal_assessment_completed_at
      ? DashboardJourneyStatus.COMPLETED
      : this.canStartPersonalAssessment(profile)
        ? DashboardJourneyStatus.AVAILABLE
        : DashboardJourneyStatus.LOCKED;

    const [completedSkillAttempts, latestSkillResult] = await Promise.all([
      this.countCompletedSkillAttempts(profile.id),
      this.getLatestResult(profile.id, AssessmentType.SKILL),
    ]);
    const hasCompletedSkillOnce = latestSkillResult != null;
    const skillAttemptsExhausted =
      !profile.advanced_assessment_completed_at &&
      completedSkillAttempts >= SKILL_ASSESSMENT_MAX_ATTEMPTS;

    let skillStatus: DashboardJourneyStatus;
    if (skillAttemptsExhausted || !this.canStartSkillAssessment(profile)) {
      skillStatus = DashboardJourneyStatus.LOCKED;
    } else if (
      profile.advanced_assessment_completed_at &&
      hasCompletedSkillOnce
    ) {
      skillStatus = DashboardJourneyStatus.COMPLETED;
    } else {
      skillStatus = DashboardJourneyStatus.AVAILABLE;
    }

    let advancedStatus: DashboardJourneyStatus;
    const advancedRetake = this.buildAdvancedRetake(profile);
    if (
      !this.canStartAdvancedAssessment(
        profile,
        hasCompletedSkillOnce,
        latestSkillResult,
      )
    ) {
      advancedStatus = DashboardJourneyStatus.LOCKED;
    } else if (advancedRetake) {
      advancedStatus = advancedRetake.ctaEnabled
        ? DashboardJourneyStatus.AVAILABLE
        : DashboardJourneyStatus.LOCKED;
    } else if (profile.advanced_assessment_completed_at) {
      advancedStatus = DashboardJourneyStatus.COMPLETED;
    } else if (
      latestSkillResult &&
      qualifiesForAdvancedFromSkillResult(latestSkillResult) &&
      profile.skill_assessment_completed_at
    ) {
      advancedStatus = DashboardJourneyStatus.AVAILABLE;
    } else {
      advancedStatus = DashboardJourneyStatus.LOCKED;
    }

    return {
      personal: personalStatus,
      skill: skillStatus,
      advanced: advancedStatus,
      completedSkillAttempts,
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
    return this.hasCompletedPersonalAssessment(profile);
  }

  private hasCompletedPersonalAssessment(profile: TalentProfile): boolean {
    return Boolean(
      profile.personal_assessment_completed_at &&
      profile.claimed_level &&
      profile.track?.trim(),
    );
  }

  private canStartAdvancedAssessment(
    profile: TalentProfile,
    hasCompletedSkillOnce: boolean,
    latestSkillResult: AssessmentResult | null,
  ): boolean {
    return Boolean(
      this.hasCompletedPersonalAssessment(profile) &&
      profile.validated_level &&
      profile.skill_assessment_completed_at &&
      hasCompletedSkillOnce &&
      latestSkillResult &&
      qualifiesForAdvancedFromSkillResult(latestSkillResult),
    );
  }
}

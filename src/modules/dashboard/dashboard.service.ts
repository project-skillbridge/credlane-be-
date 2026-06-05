import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { ErrorMessages, ForbiddenError } from '../../shared';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
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
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../talent/talent.constants';
import {
  meetsSkillQualityBenchmark,
  qualifiesForAdvancedFromSkillResult,
} from '../talent/assessment/assessment-quality';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { EmployerRole } from '../employer-roles/entities/employer-role.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import { Offer, OfferStatus } from '../offers/entities/offer.entity';
import {
  EmployerDashboardActivity,
  EmployerDashboardActivityType,
  EmployerDashboardHomeResponse,
  EmployerDashboardViewState,
} from './dto/employer-dashboard.dto';
import {
  EMPLOYER_DASHBOARD_PROFILE_COMPLETENESS_RULES,
} from './employer-dashboard.config';

const ADVANCED_RETAKE_GATE_DAYS = 14;
const EMPLOYER_RECENT_TALENT_LOOKBACK_DAYS = 14;

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
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    @InjectRepository(EmployerRole)
    private readonly employerRoleRepository: Repository<EmployerRole>,
    @InjectRepository(EmployerSavedCandidate)
    private readonly employerSavedCandidateRepository: Repository<EmployerSavedCandidate>,
    @InjectRepository(EmployerAssessment)
    private readonly employerAssessmentRepository: Repository<EmployerAssessment>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(EmployerPoolProfile)
    private readonly employerPoolProfileRepository: Repository<EmployerPoolProfile>,
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
      first_name: user.first_name,
      avatar_url: user.avatar_url,
      goal: profile?.goal ?? null,
      profile_completion_percentage: this.calculateProfileCompletion(
        user,
        profile,
      ),
      journey_overview: this.buildJourneyOverview(
        onboardingComplete,
        assessmentStatuses,
      ),
      performance,
      skill_attempts_used: assessmentStatuses.completedSkillAttempts,
      skill_max_attempts: SKILL_ASSESSMENT_MAX_ATTEMPTS,
      ...this.withAdvancedRetake(profile),
    };
  }

  async getEmployerHome(
    userId: string,
  ): Promise<EmployerDashboardHomeResponse> {
    const user = await this.usersService.findOne(userId);

    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError(ErrorMessages.COMMON.INSUFFICIENT_PERMISSIONS);
    }

    const profile = await this.employerProfileRepository.findOne({
      where: { user_id: userId },
    });

    const [
      verifiedTalentCount,
      rolesCount,
      shortlistedCount,
      createdAssessmentsCount,
      offersCount,
    ] = await Promise.all([
      this.employerPoolProfileRepository.count({
        where: { tier: 'job_ready' },
      }),
      this.employerRoleRepository.count({
        where: { employer_user_id: userId },
      }),
      this.employerSavedCandidateRepository.count({
        where: { employer_user_id: userId },
      }),
      this.employerAssessmentRepository.count({
        where: {
          employer_user_id: userId,
        },
      }),
      this.offerRepository.count({
        where: { employer_user_id: userId },
      }),
    ]);

    const viewState =
      rolesCount > 0 ||
      shortlistedCount > 0 ||
      createdAssessmentsCount > 0 ||
      offersCount > 0
        ? EmployerDashboardViewState.EXISTING_USER
        : EmployerDashboardViewState.NEW_USER;

    const companyName =
      profile?.company_name?.trim() ||
      `${user.first_name} ${user.last_name}`.trim() ||
      'there';

    const profilePrompt = this.buildEmployerProfilePrompt(profile);
    const recentActivity = await this.buildEmployerRecentActivity(userId, profile);

    return {
      company_name: companyName,
      view_state: viewState,
      profile_prompt: profilePrompt,
      overview_counts: {
        verified_talent: verifiedTalentCount,
        created_assessments: createdAssessmentsCount,
        shortlisted_candidates: shortlistedCount,
        my_roles: rolesCount,
      },
      recent_activity: recentActivity,
    };
  }

  private buildEmployerProfilePrompt(
    profile: EmployerProfile | null,
  ): EmployerDashboardHomeResponse['profile_prompt'] {
    const isVerified = profile?.is_verified ?? false;
    const missingItems: string[] = [];
    let completionPercentage = 0;

    for (const rule of EMPLOYER_DASHBOARD_PROFILE_COMPLETENESS_RULES) {
      const filled = rule.isFilled(profile, isVerified);
      if (filled) {
        completionPercentage += rule.weight;
      } else {
        missingItems.push(rule.label);
      }
    }

    return {
      show_prompt: completionPercentage < 100 || !isVerified,
      is_verified: isVerified,
      completion_percentage: Math.min(100, completionPercentage),
      missing_items: missingItems,
    };
  }

  private async buildEmployerRecentActivity(
    employerUserId: string,
    profile: EmployerProfile | null,
  ): Promise<EmployerDashboardActivity[]> {
    const [verifiedTalentActivity, shortlistActivity, acceptedOfferActivity] =
      await Promise.all([
        this.getVerifiedTalentActivity(profile),
        this.getShortlistActivity(employerUserId),
        this.getAcceptedOfferActivity(employerUserId),
      ]);

    return [verifiedTalentActivity, shortlistActivity, acceptedOfferActivity]
      .filter((activity): activity is EmployerDashboardActivity =>
        Boolean(activity),
      )
      .sort(
        (left, right) =>
          new Date(right.occurred_at).getTime() -
          new Date(left.occurred_at).getTime(),
      )
      .slice(0, 3);
  }

  private async getVerifiedTalentActivity(
    profile: EmployerProfile | null,
  ): Promise<EmployerDashboardActivity | null> {
    const roleTracks = profile?.desired_roles?.length
      ? profile.desired_roles
      : profile?.hiring_roles?.length
        ? profile.hiring_roles
        : [];

    if (roleTracks.length === 0) {
      return null;
    }

    const since = new Date();
    since.setDate(since.getDate() - EMPLOYER_RECENT_TALENT_LOOKBACK_DAYS);

    const [matchingCount, latestMatch] = await Promise.all([
      this.employerPoolProfileRepository.count({
        where: {
          tier: 'job_ready',
          track: In(roleTracks),
          verified_at: MoreThanOrEqual(since),
        },
      }),
      this.employerPoolProfileRepository.findOne({
        where: {
          tier: 'job_ready',
          track: In(roleTracks),
          verified_at: MoreThanOrEqual(since),
        },
        order: { verified_at: 'DESC' },
      }),
    ]);

    if (!matchingCount || !latestMatch) {
      return null;
    }

    const trackLabel = this.humanizeTrack(latestMatch.track ?? roleTracks[0]);
    const candidateLabel = matchingCount === 1 ? 'candidate' : 'candidates';

    return {
      id: `act_${latestMatch.id}`,
      type: EmployerDashboardActivityType.VERIFIED_TALENT,
      title: `${matchingCount} new verified ${trackLabel} ${candidateLabel} added`,
      description:
        'Fresh Job Ready talent now matches your hiring preferences.',
      occurred_at: latestMatch.verified_at.toISOString(),
    };
  }

  private async getShortlistActivity(
    employerUserId: string,
  ): Promise<EmployerDashboardActivity | null> {
    const latestSaved = await this.employerSavedCandidateRepository.findOne({
      where: { employer_user_id: employerUserId },
      relations: ['candidate'],
      order: { created_at: 'DESC' },
    });

    if (!latestSaved?.candidate) {
      return null;
    }

    return {
      id: `act_${latestSaved.id}`,
      type: EmployerDashboardActivityType.SHORTLIST,
      title: `You shortlisted ${latestSaved.candidate.fullname}`,
      description:
        'Your shortlist has a new verified candidate ready for review.',
      occurred_at: latestSaved.created_at.toISOString(),
    };
  }

  private async getAcceptedOfferActivity(
    employerUserId: string,
  ): Promise<EmployerDashboardActivity | null> {
    const latestAcceptedOffer = await this.offerRepository.findOne({
      where: {
        employer_user_id: employerUserId,
        status: OfferStatus.ACCEPTED,
      },
      relations: ['candidate'],
      order: {
        responded_at: 'DESC',
        created_at: 'DESC',
      },
    });

    if (!latestAcceptedOffer?.candidate) {
      return null;
    }

    return {
      id: `act_${latestAcceptedOffer.id}`,
      type: EmployerDashboardActivityType.OFFER_ACCEPTED,
      title: `${latestAcceptedOffer.candidate.fullname} accepted your offer`,
      description: `Role: ${latestAcceptedOffer.role_title}.`,
      occurred_at: (
        latestAcceptedOffer.responded_at ?? latestAcceptedOffer.created_at
      ).toISOString(),
    };
  }

  private humanizeTrack(value: string): string {
    return value
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
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
    const validatedLevel =
      result.validated_level ?? profile.validated_level ?? VerifiedLevel.JUNIOR;

    const failed = !meetsSkillQualityBenchmark(percentage);

    return {
      score: result.score,
      max_score: result.max_score ?? result.score,
      percentage,
      validated_level: validatedLevel,
      passed: !failed && Boolean(result.validated_level),
      failed,
      completed_at: this.toIsoTimestamp(
        profile.skill_assessment_completed_at,
        result.created_at,
      ),
      attempts_used: attemptsUsed,
      attempts_remaining: Math.max(
        0,
        SKILL_ASSESSMENT_MAX_ATTEMPTS - attemptsUsed,
      ),
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
      max_score: result.max_score ?? result.score,
      percentage,
      tier,
      tier_label: this.formatTierLabel(tier),
      integrity_confidence: result.integrity_confidence ?? 'high',
      completed_at: this.toIsoTimestamp(
        profile.advanced_assessment_completed_at,
        result.created_at,
      ),
      ...this.withNestedRetake(profile),
    };
  }

  private withAdvancedRetake(profile: TalentProfile | null): {
    advanced_retake?: DashboardRetake;
  } {
    const retake = this.buildAdvancedRetake(profile);
    return retake ? { advanced_retake: retake } : {};
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
      probation_start_date: probationStartedAt.toISOString(),
      probation_end_date: profile.assessment_locked_until.toISOString(),
      eligibility_date: profile.assessment_locked_until.toISOString(),
      cta_enabled: countdownSeconds === 0,
      countdown_seconds: countdownSeconds,
      days_remaining:
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

    const onboardingStep = this.isOnboardingComplete(user, profile)
      ? 3
      : Math.max(0, Math.min(profile.onboarding_step ?? 0, 3));

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

  /**
   * Count all skill attempts (started + completed) so the frontend shows
   * 3/3 as soon as the user starts their last session, not only after submit.
   */
  private countSkillAttempts(talentProfileId: string): Promise<number> {
    return this.assessmentAttemptRepository.count({
      where: {
        talent_profile_id: talentProfileId,
        assessment_type: AssessmentType.SKILL,
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
      this.countSkillAttempts(profile.id),
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
      advancedStatus = advancedRetake.cta_enabled
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

  private hasAdvancedAssessmentContext(profile: TalentProfile): boolean {
    return Boolean(
      profile.track?.trim() &&
        (profile.personal_assessment_completed_at ||
          profile.claimed_level ||
          profile.validated_level),
    );
  }

  private canStartAdvancedAssessment(
    profile: TalentProfile,
    hasCompletedSkillOnce: boolean,
    latestSkillResult: AssessmentResult | null,
  ): boolean {
    return Boolean(
      this.hasAdvancedAssessmentContext(profile) &&
      profile.validated_level &&
      profile.skill_assessment_completed_at &&
      hasCompletedSkillOnce &&
      latestSkillResult &&
      qualifiesForAdvancedFromSkillResult(latestSkillResult),
    );
  }
}

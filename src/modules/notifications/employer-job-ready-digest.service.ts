import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { NotificationType } from './notification-type.enum';
import {
  isNotificationDuplicateError,
  NotificationsService,
} from './notifications.service';
import { UserNotification } from './user-notification.entity';

const WEEKLY_DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const REMOTE_WORLDWIDE = 'remote worldwide';

/** Stable dedupe key (YYYY-MM-DD UTC) for the rolling digest window start. */
export function stableDigestWeekStartKey(referenceDate: Date): string {
  const weekStart = new Date(
    referenceDate.getTime() - WEEKLY_DIGEST_INTERVAL_MS,
  );
  return new Date(
    Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export type EmployerHiringPreferences = {
  hiringRoles: string[];
  hiringLocations: string[];
  preferredExperienceLevels: string[];
};

export type NewJobReadyCandidateRow = {
  candidateUserId: string;
  track: string | null;
  verifiedLevel: string;
  location: string | null;
  country: string;
};

export function resolveEmployerHiringRoles(profile: EmployerProfile): string[] {
  if (profile.hiring_roles?.length) {
    return profile.hiring_roles;
  }
  return profile.desired_roles ?? [];
}

export function hasConfiguredHiringPreferences(
  profile: EmployerProfile,
): boolean {
  return resolveEmployerHiringRoles(profile).length > 0;
}

export function candidateMatchesEmployerPreferences(
  preferences: EmployerHiringPreferences,
  candidate: NewJobReadyCandidateRow,
): boolean {
  const track = candidate.track?.trim().toLowerCase();
  if (
    !track ||
    !preferences.hiringRoles.some((role) => role.toLowerCase() === track)
  ) {
    return false;
  }

  if (preferences.preferredExperienceLevels.length > 0) {
    const level = candidate.verifiedLevel.trim().toLowerCase();
    if (
      !preferences.preferredExperienceLevels.some(
        (pref) => pref.toLowerCase() === level,
      )
    ) {
      return false;
    }
  }

  if (preferences.hiringLocations.length > 0) {
    return locationMatchesPreferences(
      preferences.hiringLocations,
      candidate.location,
      candidate.country,
    );
  }

  return true;
}

function locationMatchesPreferences(
  hiringLocations: string[],
  poolLocation: string | null,
  country: string,
): boolean {
  const location = (poolLocation ?? '').trim().toLowerCase();
  const countryLower = country.trim().toLowerCase();

  return hiringLocations.some((raw) => {
    const pref = raw.trim().toLowerCase();
    if (!pref) {
      return false;
    }
    if (pref === REMOTE_WORLDWIDE) {
      return true;
    }
    return (
      location.includes(pref) ||
      countryLower.includes(pref) ||
      (countryLower.length > 0 && pref.includes(countryLower))
    );
  });
}

@Injectable()
export class EmployerJobReadyDigestService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EmployerJobReadyDigestService.name);
  private weeklyTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepo: Repository<EmployerProfile>,
    @InjectRepository(EmployerPoolProfile)
    private readonly poolProfileRepo: Repository<EmployerPoolProfile>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
  ) {}

  onModuleInit(): void {
    void this.processWeeklyDigests();
    this.weeklyTimer = setInterval(
      () => void this.processWeeklyDigests(),
      WEEKLY_DIGEST_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.weeklyTimer) {
      clearInterval(this.weeklyTimer);
      this.weeklyTimer = null;
    }
  }

  /** Weekly batch: one in-app notification and one email per employer for matching Job Ready candidates. */
  async processWeeklyDigests(referenceDate = new Date()): Promise<void> {
    const digestWeekEnd = referenceDate;
    const digestWeekStart = new Date(
      digestWeekEnd.getTime() - WEEKLY_DIGEST_INTERVAL_MS,
    );
    const digestWeekStartIso = stableDigestWeekStartKey(referenceDate);

    const employers = await this.employerProfileRepo.find();
    const configuredEmployers = employers.filter(
      hasConfiguredHiringPreferences,
    );
    if (configuredEmployers.length === 0) {
      return;
    }

    const newCandidates = await this.loadNewJobReadyCandidates(
      digestWeekStart,
      digestWeekEnd,
    );
    if (newCandidates.length === 0) {
      return;
    }

    for (const employer of configuredEmployers) {
      try {
        await this.notifyEmployerIfMatches(
          employer,
          newCandidates,
          digestWeekStartIso,
          digestWeekEnd.toISOString(),
        );
      } catch (error) {
        this.logger.error(
          `Weekly Job Ready digest failed employer=${employer.user_id}: ${String(error)}`,
        );
      }
    }
  }

  private async loadNewJobReadyCandidates(
    digestWeekStart: Date,
    digestWeekEnd: Date,
  ): Promise<NewJobReadyCandidateRow[]> {
    const rows: Array<{
      candidateUserId: string;
      track: string | null;
      verifiedLevel: string;
      location: string | null;
      country: string;
    }> = await this.poolProfileRepo
      .createQueryBuilder('pool')
      .innerJoin(User, 'u', 'u.id = pool.candidate_id')
      .where('pool.tier = :tier', { tier: 'job_ready' })
      .andWhere('pool.verified_at >= :start AND pool.verified_at < :end', {
        start: digestWeekStart,
        end: digestWeekEnd,
      })
      .select('pool.candidate_id', 'candidateUserId')
      .addSelect('pool.track', 'track')
      .addSelect('pool.verified_level', 'verifiedLevel')
      .addSelect('pool.location', 'location')
      .addSelect('u.country', 'country')
      .getRawMany();

    return rows;
  }

  private async notifyEmployerIfMatches(
    employer: EmployerProfile,
    newCandidates: NewJobReadyCandidateRow[],
    digestWeekStart: string,
    digestWeekEnd: string,
  ): Promise<void> {
    const hiringLocations: string[] = employer.hiring_locations ?? [];
    const preferredExperienceLevels: string[] =
      employer.preferred_experience_levels ?? [];
    const preferences: EmployerHiringPreferences = {
      hiringRoles: resolveEmployerHiringRoles(employer),
      hiringLocations,
      preferredExperienceLevels,
    };

    const matches = newCandidates.filter((candidate) =>
      candidateMatchesEmployerPreferences(preferences, candidate),
    );
    if (matches.length === 0) {
      return;
    }

    const alreadySent = await this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: employer.user_id })
      .andWhere('notification.type = :type', {
        type: NotificationType.JOB_READY_MATCHES_AVAILABLE,
      })
      .andWhere("notification.data->>'digest_week_start' = :digestWeekStart", {
        digestWeekStart,
      })
      .getCount();

    if (alreadySent > 0) {
      return;
    }

    const candidateUserIds = matches.map((m) => m.candidateUserId);
    const matchCount = candidateUserIds.length;
    const label = matchCount === 1 ? 'candidate' : 'candidates';
    const verb = matchCount === 1 ? 'matches' : 'match';

    try {
      await this.notificationsService.create({
        userId: employer.user_id,
        type: NotificationType.JOB_READY_MATCHES_AVAILABLE,
        title: 'New Job Ready candidates match your preferences',
        body: `${matchCount} new Job Ready ${label} ${verb} your hiring preferences this week.`,
        data: {
          digest_week_start: digestWeekStart,
          digest_week_end: digestWeekEnd,
          match_count: matchCount,
          candidate_user_ids: candidateUserIds,
        },
      });
    } catch (error) {
      if (isNotificationDuplicateError(error)) {
        return;
      }
      throw error;
    }

    await this.sendDigestEmail(employer.user_id, matchCount);
  }

  private async sendDigestEmail(
    employerUserId: string,
    matchCount: number,
  ): Promise<void> {
    const user = await this.usersService.findOneOrNull(employerUserId);
    if (!user) {
      this.logger.warn(
        `Digest email skipped: user not found user=${employerUserId}`,
      );
      return;
    }

    try {
      await this.mailService.sendJobReadyMatchesDigest({
        to: user.email,
        recipientFirstName: user.first_name,
        matchCount,
      });
    } catch (error) {
      this.logger.error(
        `Job Ready digest email failed user=${employerUserId}: ${String(error)}`,
      );
    }
  }
}

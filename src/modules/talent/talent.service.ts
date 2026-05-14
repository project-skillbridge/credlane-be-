import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthResult, AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UploadService } from '../upload/upload.service';
import { CompleteTalentOnboardingDto } from './dto/complete-talent-onboarding.dto';
import { SetGoalDto } from './dto/set-goal.dto';
import { SetTracksDto } from './dto/set-tracks.dto';
import { SetProfileDto } from './dto/set-profile.dto';
import { SaveGoalDto } from './dto/save-goal.dto';
import { SaveTrackDto } from './dto/save-track.dto';
import { SaveTalentProfileDto } from './dto/save-talent-profile.dto';
import {
  TalentProfile,
  TalentProfileStatus,
} from './entities/talent-profile.entity';
import {
  ConflictError,
  ErrorMessages,
  ForbiddenError,
  SuccessMessages,
} from '../../shared';

export type TalentOnboardingResult = {
  message: string;
  user: AuthResult['data']['user'];
  profile: TalentProfile;
  tokens: AuthResult['tokens'];
};

export type TalentStepResult = {
  message: string;
  profile: TalentProfile;
};

@Injectable()
export class TalentService {
  private readonly logger = new Logger(TalentService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  /** Find or create a talent profile for the given user (upsert helper). */
  private async findOrCreateProfile(userId: string): Promise<TalentProfile> {
    const existing = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });
    if (existing) return existing;

    const created = this.talentProfileRepository.create({
      user_id: userId,
      role_track: null,
      role_tracks: null,
      goal: null,
      region: null,
      education_level: null,
      linkedin_url: null,
      onboarding_step: 0,
      status: TalentProfileStatus.NOT_STARTED,
      bio: null,
      profile_share_link: null,
      is_published: false,
      published_at: null,
    });
    return this.talentProfileRepository.save(created);
  }

  async updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.usersService.updateAvatar(userId, avatarUrl);
  }

  /** BE-ONB-TAL-001 — save single goal, 422 on invalid. */
  async saveGoalStep(
    userId: string,
    dto: SaveGoalDto,
  ): Promise<{ status: string; message: string }> {
    const profile = await this.findOrCreateProfile(userId);
    profile.goal = dto.goal;
    if (profile.onboarding_step < 1) profile.onboarding_step = 1;
    await this.talentProfileRepository.save(profile);
    return { status: 'success', message: SuccessMessages.ONBOARDING.GOAL_SAVED };
  }

  /** BE-ONB-TAL-002 — save single track, 422 on invalid. */
  async saveTrackStep(
    userId: string,
    dto: SaveTrackDto,
  ): Promise<{ status: string; message: string }> {
    const profile = await this.findOrCreateProfile(userId);
    profile.track = dto.track;
    if (profile.onboarding_step < 2) profile.onboarding_step = 2;
    await this.talentProfileRepository.save(profile);
    return { status: 'success', message: SuccessMessages.ONBOARDING.TRACK_SAVED };
  }

  /** BE-ONB-TAL-003 — save profile (photo required, optional fields optional). */
  async saveTalentProfile(
    userId: string,
    photo: Express.Multer.File,
    dto: SaveTalentProfileDto,
  ): Promise<{ status: string; message: string }> {
    const avatarUrl = await this.uploadService.uploadAvatar(photo);

    await this.talentProfileRepository.manager.transaction(async (manager) => {
      let user;
      try {
        user = await this.usersService.getUserForOnboarding(manager, userId);
      } catch (error: unknown) {
        if (error instanceof NotFoundException) {
          throw new ForbiddenError(ErrorMessages.ONBOARDING.INVALID_USER);
        }
        throw error;
      }

      await manager.update(User, { id: userId }, { avatar_url: avatarUrl });

      let profile = await manager.findOne(TalentProfile, { where: { user_id: userId } });
      if (!profile) {
        profile = manager.create(TalentProfile, {
          user_id: userId,
          status: TalentProfileStatus.NOT_STARTED,
          is_published: false,
        });
      }

      profile.region = dto.region ?? null;
      profile.education_level = dto.educationLevel ?? null;
      profile.linkedin_url = dto.linkedinProfile ?? null;
      profile.onboarding_step = 3;
      profile.profile_verified =
        !!dto.region && !!dto.educationLevel && !!dto.linkedinProfile;

      await manager.save(TalentProfile, profile);

      if (!user.onboarding_complete) {
        await this.usersService.markOnboardingCompleteWithManager(manager, userId);
      }
    });

    return { status: 'success', message: SuccessMessages.ONBOARDING.TALENT_PROFILE_SAVED };
  }

  /** BE-ONB-TAL-004 — trigger personalisation from saved onboarding data. */
  async personalise(userId: string): Promise<{ status: string; message: string }> {
    const profile = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });

    if (!profile?.track) {
      throw new UnprocessableEntityException(
        ErrorMessages.ONBOARDING.TRACK_REQUIRED_FOR_PERSONALISE,
      );
    }

    const availableDataPoints: string[] = ['track'];
    if (profile.goal) availableDataPoints.push('goal');
    if (profile.region) availableDataPoints.push('region');
    if (profile.education_level) availableDataPoints.push('educationLevel');

    const isFullyPersonalised =
      !!profile.goal && !!profile.region && !!profile.education_level;

    try {
      this.logger.log(
        JSON.stringify({
          event: 'talent_personalisation',
          userId,
          timestamp: new Date().toISOString(),
          availableDataPoints,
          assessmentsGenerated: true,
          recommendationsGenerated: isFullyPersonalised,
          incompleteFields: isFullyPersonalised
            ? []
            : ['goal', 'region', 'educationLevel'].filter(
                (f) =>
                  !profile[f === 'educationLevel' ? 'education_level' : (f as keyof TalentProfile)],
              ),
        }),
      );

      return { status: 'success', message: SuccessMessages.ONBOARDING.DASHBOARD_PERSONALISED };
    } catch {
      throw new InternalServerErrorException(
        ErrorMessages.ONBOARDING.PERSONALISATION_FAILED,
      );
    }
  }

  async getOnboardingState(userId: string): Promise<{ profile: TalentProfile | null; user: { id: string; email: string; first_name: string; last_name: string; avatar_url: string | null } }> {
    const user = await this.usersService.findOne(userId);
    const profile = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
      },
      profile,
    };
  }

  async saveGoal(userId: string, dto: SetGoalDto): Promise<TalentStepResult> {
    const user = await this.usersService.findOne(userId);
    if (user.onboarding_complete) {
      throw new ForbiddenError(ErrorMessages.ONBOARDING.ALREADY_COMPLETED);
    }

    const profile = await this.findOrCreateProfile(userId);
    profile.goal = dto.goal;
    if (profile.onboarding_step < 1) profile.onboarding_step = 1;

    const saved = await this.talentProfileRepository.save(profile);
    return { message: SuccessMessages.ONBOARDING.GOAL_SAVED, profile: saved };
  }

  async saveTracks(userId: string, dto: SetTracksDto): Promise<TalentStepResult> {
    const user = await this.usersService.findOne(userId);
    if (user.onboarding_complete) {
      throw new ForbiddenError(ErrorMessages.ONBOARDING.ALREADY_COMPLETED);
    }

    const profile = await this.findOrCreateProfile(userId);
    profile.role_tracks = dto.roleTracks;
    if (profile.onboarding_step < 2) profile.onboarding_step = 2;

    const saved = await this.talentProfileRepository.save(profile);
    return { message: SuccessMessages.ONBOARDING.TRACKS_SAVED, profile: saved };
  }

  async saveProfile(
    userId: string,
    dto: SetProfileDto,
  ): Promise<TalentOnboardingResult> {
    const profile = await this.talentProfileRepository.manager.transaction(
      async (manager) => {
        let user;
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

        let talentProfile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
        });
        if (!talentProfile) {
          talentProfile = manager.create(TalentProfile, {
            user_id: userId,
            status: TalentProfileStatus.NOT_STARTED,
            is_published: false,
          });
        }

        talentProfile.region = dto.region;
        talentProfile.education_level = dto.educationLevel;
        talentProfile.linkedin_url = dto.linkedinUrl ?? null;
        talentProfile.onboarding_step = 3;

        if (dto.avatarUrl) {
          await manager.update(User, { id: userId }, { avatar_url: dto.avatarUrl });
        }

        const savedProfile = await manager.save(TalentProfile, talentProfile);
        await this.usersService.markOnboardingCompleteWithManager(manager, userId);

        return savedProfile;
      },
    );

    const session = await this.authService.issueSessionForUser(
      userId,
      SuccessMessages.ONBOARDING.PROFILE_SAVED,
    );

    return {
      message: session.message,
      user: session.data.user,
      profile,
      tokens: session.tokens,
    };
  }

  /** Legacy single-step onboarding — kept for backward compatibility. */
  async completeOnboarding(
    userId: string,
    dto: CompleteTalentOnboardingDto,
  ): Promise<TalentOnboardingResult> {
    const profile = await this.talentProfileRepository.manager.transaction(
      async (manager) => {
        let user;
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

        const existingProfile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
        });
        if (existingProfile) {
          throw new ConflictError(ErrorMessages.ONBOARDING.TALENT_PROFILE_EXISTS);
        }

        const nextProfile = manager.create(TalentProfile, {
          user_id: userId,
          role_track: dto.roleTrack.trim(),
          bio: dto.bio?.trim() || null,
          status: TalentProfileStatus.NOT_STARTED,
          profile_share_link: null,
          is_published: false,
          published_at: null,
        });

        const savedProfile = await manager.save(TalentProfile, nextProfile);
        await this.usersService.markOnboardingCompleteWithManager(
          manager,
          userId,
        );

        return savedProfile;
      },
    );

    const session = await this.authService.issueSessionForUser(
      userId,
      SuccessMessages.ONBOARDING.TALENT_COMPLETED,
    );

    return {
      message: session.message,
      user: session.data.user,
      profile,
      tokens: session.tokens,
    };
  }
}
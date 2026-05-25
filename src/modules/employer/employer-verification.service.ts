import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerProfile } from './entities/employer-profile.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class EmployerVerificationService {
  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepo: Repository<EmployerProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Evaluates all three verification criteria and updates the profile.
   * Returns the new is_verified value.
   */
  async checkAndUpdateVerification(employerUserId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: employerUserId },
    });
    if (!user) return false;

    const profile = await this.employerProfileRepo.findOne({
      where: { user_id: employerUserId },
    });
    if (!profile) return false;

    const emailVerified = user.is_verified === true;
    const hasLinkedin = !!profile.linkedin_company_page_url;
    const websiteResolvable = await this.isWebsiteResolvable(
      profile.company_website ?? profile.website_url,
    );

    const shouldBeVerified = emailVerified && hasLinkedin && websiteResolvable;

    if (profile.is_verified !== shouldBeVerified) {
      await this.employerProfileRepo.update(
        { user_id: employerUserId },
        { is_verified: shouldBeVerified },
      );
    }

    return shouldBeVerified;
  }

  /**
   * Returns current verification status from the profile (cached value).
   */
  async getVerificationStatus(employerUserId: string): Promise<boolean> {
    const profile = await this.employerProfileRepo.findOne({
      where: { user_id: employerUserId },
    });
    return profile?.is_verified ?? false;
  }

  /**
   * Checks if a URL is resolvable by sending a HEAD request (falls back to GET on 405).
   */
  async isWebsiteResolvable(url: string | null | undefined): Promise<boolean> {
    if (!url) return false;

    const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(normalizedUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (response.status === 405) {
        // HEAD not allowed, try GET
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 5000);

        const getResponse = await fetch(normalizedUrl, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'follow',
        });

        clearTimeout(timeout2);
        return getResponse.ok;
      }

      return response.ok;
    } catch {
      return false;
    }
  }
}

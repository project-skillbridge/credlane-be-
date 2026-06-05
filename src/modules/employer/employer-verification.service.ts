import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dns from 'dns/promises';
import * as net from 'net';
import { EmployerProfile } from './entities/employer-profile.entity';
import { User } from '../users/entities/user.entity';
import { ForbiddenError } from '../../shared';
import { ErrorMessages } from '../../shared/messages/error.messages';

/** IP ranges that must never be reached by server-side fetches. */
const BLOCKED_CIDRS: Array<{ prefix: bigint; mask: bigint }> = [
  // IPv4
  { prefix: ipToBigInt('127.0.0.0'), mask: cidrMask(8, 32) },
  { prefix: ipToBigInt('10.0.0.0'), mask: cidrMask(8, 32) },
  { prefix: ipToBigInt('172.16.0.0'), mask: cidrMask(12, 32) },
  { prefix: ipToBigInt('192.168.0.0'), mask: cidrMask(16, 32) },
  { prefix: ipToBigInt('169.254.0.0'), mask: cidrMask(16, 32) },
  { prefix: ipToBigInt('0.0.0.0'), mask: cidrMask(8, 32) },
  // IPv6
  { prefix: ipv6ToBigInt('::1'), mask: cidrMask(128, 128) },
  { prefix: ipv6ToBigInt('fc00::'), mask: cidrMask(7, 128) },
  { prefix: ipv6ToBigInt('fe80::'), mask: cidrMask(10, 128) },
];

const ALLOWED_PORTS = new Set([80, 443]);

function ipToBigInt(ip: string): bigint {
  const parts = ip.split('.').map(Number);
  return BigInt(
    (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3],
  );
}

function ipv6ToBigInt(ip: string): bigint {
  const expanded = expandIPv6(ip);
  const parts = expanded.split(':');
  let result = 0n;
  for (const part of parts) {
    result = (result << 16n) | BigInt(parseInt(part, 16));
  }
  return result;
}

function expandIPv6(ip: string): string {
  const sides = ip.split('::');
  const left: string[] = sides[0] ? sides[0].split(':') : [];
  const right: string[] = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const middle: string[] = Array<string>(missing).fill('0000');
  return [...left, ...middle, ...right]
    .map((g: string) => g.padStart(4, '0'))
    .join(':');
}

function cidrMask(prefixLen: number, bits: number): bigint {
  if (prefixLen === 0) return 0n;
  return ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefixLen)) - 1n);
}

function isBlockedIp(ip: string): boolean {
  const isV6 = ip.includes(':');
  const numeric = isV6 ? ipv6ToBigInt(ip) : ipToBigInt(ip);
  for (const { prefix, mask } of BLOCKED_CIDRS) {
    if ((numeric & mask) === (prefix & mask)) return true;
  }
  return false;
}

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
    const hasLinkedin = !!(
      profile.linkedin_company_page_url || profile.linkedin_company_url
    );
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
   * Returns structured verification criteria for the employer settings UI.
   */
  async getVerificationStatusDetail(employerUserId: string): Promise<{
    verified: boolean;
    criteria: {
      email_verified: boolean;
      website_resolvable: boolean;
      linkedin_provided: boolean;
    };
    banner_visible: boolean;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: employerUserId },
    });
    const profile = await this.employerProfileRepo.findOne({
      where: { user_id: employerUserId },
    });

    const emailVerified = user?.is_verified === true;
    const linkedinProvided = !!(
      profile?.linkedin_company_page_url || profile?.linkedin_company_url
    );
    const websiteResolvable = await this.isWebsiteResolvable(
      profile?.company_website ?? profile?.website_url,
    );
    const verified = emailVerified && linkedinProvided && websiteResolvable;

    return {
      verified,
      criteria: {
        email_verified: emailVerified,
        website_resolvable: websiteResolvable,
        linkedin_provided: linkedinProvided,
      },
      banner_visible: !verified,
    };
  }

  /**
   * Throws ForbiddenError if the employer is not verified.
   * Use as a gate before privileged actions (offers, contact requests).
   */
  async assertEmployerVerified(employerUserId: string): Promise<void> {
    const verified = await this.getVerificationStatus(employerUserId);
    if (!verified) {
      throw new ForbiddenError(
        ErrorMessages.EMPLOYER_VERIFICATION.NOT_VERIFIED,
      );
    }
  }

  private static readonly MAX_REDIRECTS = 5;

  /**
   * Checks if a URL is resolvable via HEAD (fallback GET on 405).
   * Hardened against SSRF: rejects private/internal IPs and non-standard ports.
   */
  async isWebsiteResolvable(
    url: string | null | undefined,
    redirectDepth = 0,
  ): Promise<boolean> {
    if (redirectDepth >= EmployerVerificationService.MAX_REDIRECTS)
      return false;
    if (!url) return false;

    const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

    // Parse and validate URL structure
    let parsed: URL;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      return false;
    }

    // Only allow http(s)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    // Block non-standard ports
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
    if (!ALLOWED_PORTS.has(port)) return false;

    // Reject IP-literal hosts directly
    if (net.isIP(parsed.hostname)) {
      if (isBlockedIp(parsed.hostname)) return false;
    } else {
      // Resolve hostname and check all IPs (IPv4 + IPv6)
      try {
        const [v4Addresses, v6Addresses] = await Promise.all([
          dns.resolve4(parsed.hostname).catch(() => [] as string[]),
          dns.resolve6(parsed.hostname).catch(() => [] as string[]),
        ]);
        const allAddresses = [...v4Addresses, ...v6Addresses];
        if (allAddresses.length === 0) return false;
        if (allAddresses.some((addr) => isBlockedIp(addr))) return false;
      } catch {
        return false;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(normalizedUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
      });

      clearTimeout(timeout);

      // If redirect, validate the target before following
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          return this.isWebsiteResolvable(
            new URL(location, parsed).toString(),
            redirectDepth + 1,
          );
        }
        return false;
      }

      if (response.status === 405) {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 5000);

        const getResponse = await fetch(normalizedUrl, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'manual',
        });

        clearTimeout(timeout2);

        if (getResponse.status >= 300 && getResponse.status < 400) {
          const loc = getResponse.headers.get('location');
          if (loc) {
            return this.isWebsiteResolvable(
              new URL(loc, parsed).toString(),
              redirectDepth + 1,
            );
          }
          return false;
        }

        return getResponse.ok;
      }

      return response.ok;
    } catch {
      return false;
    }
  }
}

import { ForbiddenException } from '@nestjs/common';
import { PROFILE_COOLDOWN_DAYS } from './employer.constants';
import { EmployerProfile } from './entities/employer-profile.entity';
import { ErrorMessages } from '../../shared/messages/error.messages';

const COOLDOWN_MS = PROFILE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export type RestrictedEmployerProfileFieldKey =
  | 'company_name'
  | 'company_website'
  | 'linkedin_url';

export type RestrictedFieldMetadata = {
  locked: boolean;
  last_changed_at: string | null;
  next_editable_at: string | null;
};

export type EmployerRestrictedFieldsMetadata = Record<
  RestrictedEmployerProfileFieldKey,
  RestrictedFieldMetadata
>;

export class ProfileFieldLockedError extends ForbiddenException {
  constructor(payload: {
    field: RestrictedEmployerProfileFieldKey;
    last_changed_at: string;
    next_editable_at: string;
    remaining_seconds: number;
  }) {
    super({
      error: 'PROFILE_FIELD_LOCKED',
      message: ErrorMessages.EMPLOYER_PROFILE.FIELD_LOCKED(
        payload.last_changed_at,
        payload.next_editable_at,
      ),
      ...payload,
    });
  }
}

function getChangedAt(
  profile: EmployerProfile,
  field: RestrictedEmployerProfileFieldKey,
): Date | null {
  switch (field) {
    case 'company_name':
      return profile.company_name_changed_at;
    case 'company_website':
      return profile.company_website_changed_at;
    case 'linkedin_url':
      return profile.linkedin_url_changed_at;
    default:
      return null;
  }
}

function setChangedAt(
  profile: EmployerProfile,
  field: RestrictedEmployerProfileFieldKey,
  value: Date,
): void {
  switch (field) {
    case 'company_name':
      profile.company_name_changed_at = value;
      break;
    case 'company_website':
      profile.company_website_changed_at = value;
      break;
    case 'linkedin_url':
      profile.linkedin_url_changed_at = value;
      break;
  }
}

export function buildRestrictedFieldMetadata(
  changedAt: Date | null,
  now = new Date(),
): RestrictedFieldMetadata {
  if (!changedAt) {
    return {
      locked: false,
      last_changed_at: null,
      next_editable_at: null,
    };
  }

  const nextEditableAt = new Date(changedAt.getTime() + COOLDOWN_MS);
  const locked = nextEditableAt > now;

  return {
    locked,
    last_changed_at: changedAt.toISOString(),
    next_editable_at: locked ? nextEditableAt.toISOString() : null,
  };
}

export function buildRestrictedFieldsMetadata(
  profile: EmployerProfile,
  now = new Date(),
): EmployerRestrictedFieldsMetadata {
  return {
    company_name: buildRestrictedFieldMetadata(
      profile.company_name_changed_at,
      now,
    ),
    company_website: buildRestrictedFieldMetadata(
      profile.company_website_changed_at,
      now,
    ),
    linkedin_url: buildRestrictedFieldMetadata(
      profile.linkedin_url_changed_at,
      now,
    ),
  };
}

export function assertRestrictedFieldEditable(
  profile: EmployerProfile,
  field: RestrictedEmployerProfileFieldKey,
  now = new Date(),
): void {
  const changedAt = getChangedAt(profile, field);
  if (!changedAt) {
    return;
  }

  const nextEditableAt = new Date(changedAt.getTime() + COOLDOWN_MS);
  if (nextEditableAt <= now) {
    return;
  }

  throw new ProfileFieldLockedError({
    field,
    last_changed_at: changedAt.toISOString(),
    next_editable_at: nextEditableAt.toISOString(),
    remaining_seconds: Math.max(
      0,
      Math.ceil((nextEditableAt.getTime() - now.getTime()) / 1000),
    ),
  });
}

export function markRestrictedFieldChanged(
  profile: EmployerProfile,
  field: RestrictedEmployerProfileFieldKey,
  now = new Date(),
): void {
  setChangedAt(profile, field, now);
}

export function normalizeLinkedinUrl(profile: EmployerProfile): string | null {
  return (
    profile.linkedin_company_page_url?.trim() ||
    profile.linkedin_company_url?.trim() ||
    null
  );
}

export function normalizeCompanyWebsite(
  profile: EmployerProfile,
): string | null {
  return profile.company_website?.trim() || profile.website_url?.trim() || null;
}

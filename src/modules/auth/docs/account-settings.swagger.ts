import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { DeactivateAccountDto } from '../dto/deactivate-account.dto';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { RequestEmailChangeDto } from '../dto/request-email-change.dto';
import { VerifyEmailChangeDto } from '../dto/verify-email-change.dto';
import {
  AccountDataExportResponseDto,
  BasicSuccessResponseDto,
  EmailChangeRequestedResponseDto,
  EmailChangeVerifiedResponseDto,
} from '../dto/account-settings-response.dto';

export const ACCOUNT_SETTINGS_NEXTJS_GUIDE = `
## Next.js — Account settings tab

**Auth:** User must be logged in. Use httpOnly cookies from \`POST /auth/login\`; call fetch with \`credentials: 'include'\`.

**Base URL:** \`\${NEXT_PUBLIC_API_URL}/api/v1\`

### Change email
1. \`POST /auth/change-email/request\` with \`{ "new_email": "new@example.com" }\`.
2. User enters OTP from the new email.
3. \`POST /auth/change-email/verify\` with \`{ "new_email": "new@example.com", "otp": "123456" }\`.
4. Cookies are cleared; ask user to log in again.

### Change password
\`POST /auth/change-password\` requires current password and clears cookies after success.

### Data export
\`POST /auth/account/data-export\` currently returns a JSON snapshot immediately.

### Deactivate/Delete
\`PATCH /auth/account/deactivate\` requires \`confirmation: "DEACTIVATE"\`.
\`DELETE /auth/account\` requires \`confirmation: "DELETE"\`.
Both use soft-delete with an audit snapshot and clear auth cookies.
`.trim();

export const ApiAccountSettingsTags = () =>
  applyDecorators(ApiTags('Account Settings'));

export const ApiChangePasswordSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Change password for the authenticated user',
      description: `${ACCOUNT_SETTINGS_NEXTJS_GUIDE}

Verifies the current password, rejects reuse of the same password, updates to the new password, and clears auth cookies.`,
    }),
    ApiBody({ type: ChangePasswordDto }),
    ApiResponse({
      status: 200,
      description: 'Password changed; auth cookies cleared',
      type: BasicSuccessResponseDto,
    }),
    ApiResponse({
      status: 400,
      description:
        'Current password incorrect, new password same as current, or OAuth account has no password',
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 422, description: 'Passwords do not match' }),
    ApiResponse({ status: 429, description: 'Too many requests' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiRequestEmailChangeSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Send an OTP to a new work email before changing account email',
      description:
        'Starts the change-email flow. The account email is not updated until the OTP sent to the new email is verified.',
    }),
    ApiBody({ type: RequestEmailChangeDto }),
    ApiResponse({
      status: 200,
      description: 'OTP sent to new email',
      type: EmailChangeRequestedResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Email already registered' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 429, description: 'Too many requests' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiVerifyEmailChangeSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Verify the new work email OTP and apply the email change',
      description:
        'Applies the account email change only after OTP verification. Auth cookies are cleared after success.',
    }),
    ApiBody({ type: VerifyEmailChangeDto }),
    ApiResponse({
      status: 200,
      description: 'Email changed; auth cookies cleared',
      type: EmailChangeVerifiedResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Invalid or expired otp' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 429, description: 'Too many requests' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiRequestAccountDataExport = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Request/download a copy of the authenticated account data',
      description:
        'Returns a JSON data export snapshot immediately for the Account tab Request export action.',
    }),
    ApiResponse({
      status: 200,
      description: 'Data export generated',
      type: AccountDataExportResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiDeactivateAccountSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Deactivate the authenticated account',
      description:
        'Requires typed confirmation, soft-deletes the account, records an audit snapshot, anonymizes the live email, and clears auth cookies.',
    }),
    ApiBody({ type: DeactivateAccountDto }),
    ApiResponse({
      status: 200,
      description: 'Account deactivated',
      type: BasicSuccessResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Typed confirmation missing' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiDeleteAccountSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Delete the authenticated account',
      description:
        'Requires typed confirmation. The implementation uses production-style soft delete with an immutable audit snapshot, not a hard database delete.',
    }),
    ApiBody({ type: DeleteAccountDto }),
    ApiResponse({
      status: 200,
      description: 'Account deleted',
      type: BasicSuccessResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Typed confirmation missing' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

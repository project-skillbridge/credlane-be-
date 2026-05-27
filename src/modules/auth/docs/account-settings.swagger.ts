import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { RequestEmailChangeDto } from '../dto/request-email-change.dto';
import { VerifyEmailChangeDto } from '../dto/verify-email-change.dto';
import {
  AccountDataExportResponseDto,
  BasicSuccessResponseDto,
  EmailChangeRequestedResponseDto,
  EmailChangeVerifiedResponseDto,
} from '../dto/account-settings-response.dto';

export const ApiAccountSettingsTags = () => applyDecorators();

export const ApiChangePasswordSettings = () =>
  applyDecorators(
    ApiAccountSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Change password for the authenticated user',
      description:
        'Verifies the current password, updates the password, and clears auth cookies after success.',
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
        'Sends a verification OTP to the requested new email address.',
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
        'Verifies the email-change OTP, updates the account email, and clears auth cookies.',
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
      description: 'Returns a JSON snapshot of the authenticated account data.',
    }),
    ApiResponse({
      status: 200,
      description: 'Data export generated',
      type: AccountDataExportResponseDto,
    }),
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
        'Requires typed confirmation and soft-deletes the authenticated account.',
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

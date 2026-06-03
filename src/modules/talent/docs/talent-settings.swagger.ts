import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  CommunicationPreferencesEnvelopeDto,
  CommunicationPreferencesUpdatedResponseDto,
  TalentAvailabilityUpdatedResponseDto,
  TalentResumeDeleteResponseDto,
  TalentResumeUploadResponseDto,
  TalentSettingsProfileUpdatedResponseDto,
  TalentSettingsResponseDto,
} from '../dto/settings-response.dto';
import {
  UpdateCommunicationPreferencesDto,
  UpdateTalentAvailabilityDto,
  UpdateTalentSettingsProfileDto,
} from '../dto/settings.dto';

export const ApiTalentSettingsTags = () => applyDecorators();

export const ApiGetTalentSettings = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get talent settings page data',
      description:
        'Returns talent profile, communication, and account settings data.',
    }),
    ApiResponse({
      status: 200,
      description: 'Settings page data returned',
      type: TalentSettingsResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiUpdateTalentSettingsProfile = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update talent settings profile fields',
      description:
        'Updates editable talent profile fields (name, role track, LinkedIn, personal website). Bio is read-only in settings and is not accepted on this endpoint. All request fields are optional.',
    }),
    ApiBody({ type: UpdateTalentSettingsProfileDto }),
    ApiResponse({
      status: 200,
      description: 'Settings profile updated',
      type: TalentSettingsProfileUpdatedResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 422, description: 'Validation failed' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiUploadTalentSettingsResume = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Upload resume/CV for talent settings',
      description:
        'Uploads a resume file and stores the resume URL on the talent profile.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'PDF, DOC, DOCX, or TXT resume file.',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Resume uploaded',
      type: TalentResumeUploadResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Missing or invalid file' }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({
      status: 503,
      description: 'File upload is not configured on this server',
    }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiDeleteTalentSettingsResume = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete uploaded resume/CV' }),
    ApiResponse({
      status: 200,
      description: 'Resume deleted',
      type: TalentResumeDeleteResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
  );

export const ApiUpdateTalentAvailability = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update talent availability setting',
      description: 'Updates talent availability and published profile state.',
    }),
    ApiBody({ type: UpdateTalentAvailabilityDto }),
    ApiResponse({
      status: 200,
      description: 'Availability updated',
      type: TalentAvailabilityUpdatedResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 422, description: 'Invalid availability status' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiGetCommunicationPreferences = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get talent communication preferences',
      description: 'Returns email and in-app notification preferences.',
    }),
    ApiResponse({
      status: 200,
      description: 'Communication preferences returned',
      type: CommunicationPreferencesEnvelopeDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiUpdateCommunicationPreferences = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update talent communication preferences',
      description: 'Updates email and/or in-app notification preferences.',
    }),
    ApiBody({ type: UpdateCommunicationPreferencesDto }),
    ApiResponse({
      status: 200,
      description: 'Communication preferences updated',
      type: CommunicationPreferencesUpdatedResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 422, description: 'Validation failed' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

export const ApiUnsubscribeEmailNotifications = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Unsubscribe from all email notifications',
      description: 'Disables all email notification preferences.',
    }),
    ApiResponse({
      status: 200,
      description: 'Email notifications disabled',
      type: CommunicationPreferencesUpdatedResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Authentication required' }),
    ApiResponse({ status: 403, description: 'Talent access required' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  );

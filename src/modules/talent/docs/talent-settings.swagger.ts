import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CommunicationPreferencesEnvelopeDto,
  CommunicationPreferencesUpdatedResponseDto,
  TalentAvailabilityUpdatedResponseDto,
  TalentResumeUploadResponseDto,
  TalentSettingsProfileUpdatedResponseDto,
  TalentSettingsResponseDto,
} from '../dto/settings-response.dto';
import {
  UpdateCommunicationPreferencesDto,
  UpdateTalentAvailabilityDto,
  UpdateTalentSettingsProfileDto,
} from '../dto/settings.dto';

export const TALENT_SETTINGS_NEXTJS_GUIDE = `
## Next.js — Talent Settings page

**Auth:** Talent user must be logged in. Use httpOnly cookies from \`POST /auth/login\`; call fetch with \`credentials: 'include'\`.

**Base URL:** \`\${NEXT_PUBLIC_API_URL}/api/v1\`

### Page load
\`GET /talent/settings\` returns the data needed for the About, Resume, Availability, Communication, and Account tabs.

### About me tab
\`PATCH /talent/settings/profile\` accepts snake_case fields only: \`first_name\`, \`last_name\`, \`role_track\`, \`linkedin_url\`, \`bio\`, \`personal_website\`.

### Resume tab
\`POST /talent/settings/resume\` is multipart form-data with \`file\`.
Allowed file types: PDF, DOC, DOCX, TXT. Upload requires S3 env configuration.

### Availability tab
\`PATCH /talent/settings/availability\` accepts \`availability_status\`:
\`actively_looking\`, \`open_to_opportunities\`, or \`not_looking\`.
\`not_looking\` hides the published profile; the other states publish it.

### Communication tab
\`GET/PATCH /talent/settings/communication-preferences\` returns and updates grouped \`email\` and \`in_app\` notification toggles.
\`PATCH /talent/settings/communication-preferences/email/unsubscribe\` turns off all email toggles.
`.trim();

export const ApiTalentSettingsTags = () =>
  applyDecorators(ApiTags('Talent Settings'));

export const ApiGetTalentSettings = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get talent settings page data',
      description: TALENT_SETTINGS_NEXTJS_GUIDE,
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
        'Updates the About me fields used by the settings page. All request fields are optional and use snake_case.',
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
        'Uploads a resume file to the configured S3 bucket and stores the public URL on the talent profile.',
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

export const ApiUpdateTalentAvailability = () =>
  applyDecorators(
    ApiTalentSettingsTags(),
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update talent availability setting',
      description:
        'Controls availability shown in the settings page and synchronizes the employer pool availability when the talent has a pool profile.',
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
      description:
        'Returns email and in-app notification toggle state for the Communication tab.',
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
      description:
        'Updates email and/or in-app notification toggles. Omitted toggles are left unchanged.',
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
      description:
        'Convenience endpoint for the Communication tab Unsubscribe action. It disables all email notification toggles and leaves in-app toggles unchanged.',
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

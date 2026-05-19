export const ErrorMessages = {
  AUTH: {
    INVALID_OR_EXPIRED_OTP: 'Invalid or expired otp',
    ACCOUNT_NOT_FOUND: 'Account not found',
    ACCOUNT_ALREADY_VERIFIED: 'Account is already verified',
    TOO_MANY_REQUESTS: 'Too many requests. Please wait before trying again.',
    INVALID_CREDENTIALS: 'Invalid credentials',
    EMAIL_NOT_VERIFIED: 'Please verify your email to continue',
    INVALID_OR_EXPIRED_TOKEN: 'Invalid or expired token',
    TOKEN_ALREADY_USED: 'Token already used',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    REFRESH_TOKEN_REVOKED: 'Refresh token has been revoked',
    INVALID_ACCESS_TOKEN: 'Invalid access token',
    GOOGLE_AUTH_FAILED: 'Google authentication failed',
    INVALID_OAUTH_SIGNUP_ROLE: 'Invalid OAuth signup role',
    OAUTH_SIGNUP_ROLE_REQUIRED: 'OAuth signup role required',
  },
  USER: {
    EMAIL_ALREADY_REGISTERED: 'Email already registered',
    NOT_FOUND: (id: string) => `User ${id} not found`,
    UPDATE_FAILED: 'Failed to update user',
  },
  INQUIRIES: {
    EMAIL_ALREADY_ON_WAITLIST: 'Email already on waitlist',
  },
  ASSESSMENT: {
    INVALID_SECTION: 'Section must be an integer between 1 and 7',
    ALREADY_COMPLETED: 'Personal assessment is already completed',
  },
  SKILL_ASSESSMENT: {
    PROFILE_NOT_FOUND: 'Talent profile not found',
    PERSONAL_ASSESSMENT_INCOMPLETE:
      'Complete your personal assessment before starting a skill assessment',
    CLAIMED_LEVEL_MISSING:
      'claimed_level is required to start a skill assessment; please complete onboarding track step first',
    TRACK_MISSING:
      'track is required to start a skill assessment; please complete onboarding track step first',
    NO_QUESTIONS_AVAILABLE:
      'No skill assessment questions are currently available for your track and level',
    ATTEMPT_NOT_FOUND: 'Assessment attempt not found',
    ATTEMPT_ALREADY_SUBMITTED:
      'This assessment attempt has already been submitted',
    ATTEMPT_CORRUPT:
      'Assessment attempt has no questions; please start a new session',
    PASS_REQUIRED:
      'You need a score of 75% or higher in the skill assessment before starting the advanced assessment',
  },
  ADVANCED_ASSESSMENT: {
    PROFILE_NOT_FOUND: 'Talent profile not found',
    PERSONAL_ASSESSMENT_INCOMPLETE:
      'Complete your personal assessment before starting the advanced assessment',
    SKILL_GATE_REQUIRED:
      'Complete and pass the skill assessment before starting the advanced assessment',
    LEVEL_NOT_VERIFIED: 'LEVEL_NOT_VERIFIED',
    BANK_EXHAUSTED: 'BANK_EXHAUSTED',
    ACTIVE_SESSION_EXISTS: 'Active advanced assessment session already exists',
    SESSION_NOT_FOUND: 'Advanced assessment session not found',
    SESSION_CORRUPT: 'Advanced assessment session has no questions',
    ATTEMPT_NOT_FOUND: 'Assessment session not found',
    ATTEMPT_ALREADY_SUBMITTED: 'This assessment session has already been submitted',
    SESSION_EXPIRED: 'Assessment session has expired',
    RETAKE_LOCKED: (unlocksAt: string) =>
      `Advanced assessment is locked until ${unlocksAt}. Retakes are available after a 14-day gate.`,
    SESSION_VOIDED: 'Assessment session has been voided due to integrity violations. A 14-day retake gate has started.',
  },
  ONBOARDING: {
    INVALID_USER: 'Invalid user',
    ALREADY_COMPLETED: 'Onboarding already completed',
    TALENT_PROFILE_EXISTS: 'Talent profile already exists',
    EMPLOYER_PROFILE_EXISTS: 'Employer profile already exists',
    CANDIDATE_PROFILE_EXISTS: 'Candidate profile already exists',
    NO_FILE: 'No file provided',
    PHOTO_REQUIRED: 'Photo is required',
    INVALID_FILE_TYPE: 'Only image files are allowed (jpeg, png, webp)',
    INVALID_PHOTO_TYPE: 'Invalid file type, please upload a valid image',
    FILE_TOO_LARGE: 'File must be smaller than 5 MB',
    PHOTO_TOO_LARGE: 'File size too large, please upload a smaller image',
    TRACK_REQUIRED_FOR_PERSONALISE: 'Track is required to generate assessments',
    PERSONALISATION_FAILED: 'Personalisation failed, please try again',
  },
  COMMON: {
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
} as const;

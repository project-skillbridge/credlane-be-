export const SuccessMessages = {
  AUTH: {
    VERIFICATION_OTP_SENT: 'Verification otp sent',
    EMAIL_VERIFIED: 'Email verified',
    VERIFICATION_EMAIL_RESENT: 'Verification email resent',
    LOGIN: 'Login successful',
    FORGOT_PASSWORD: 'If that email exists, a reset code has been sent',
    PASSWORD_RESET_OTP_VERIFIED: 'OTP verified',
    PASSWORD_UPDATED: 'Password updated. Please log in.',
    PASSWORD_CHANGED: 'Password changed successfully. Please log in again.',
    TOKEN_REFRESHED: 'Token refreshed successfully',
    LOGGED_OUT: 'Logged out',
  },
  INQUIRIES: {
    WAITLIST_JOINED: 'Added to waitlist',
    MESSAGE_RECEIVED: 'Message received',
  },
  ASSESSMENT: {
    SECTION_SAVED: 'Personal assessment section saved',
    COMPLETED: 'Personal assessment completed',
  },
  SKILL_ASSESSMENT: {
    STARTED: 'Skill assessment session created',
    SESSION_RESUMED: 'Skill assessment session returned',
    SUBMITTED: 'Skill assessment submitted successfully',
    FAILED:
      'Your overall score was below 50%. This attempt does not count toward verification. You may retake the skill assessment.',
    DOWNGRADE_NOTICE:
      'Your assessment has been personalised to your verified level.',
  },
  ADVANCED_ASSESSMENT: {
    STARTED: 'Advanced assessment session created',
    SESSION_RESUMED: 'Advanced assessment session returned',
    SUBMITTED: 'Advanced assessment submitted and scored',
    QUEUED: 'Advanced assessment submission accepted for processing',
    FAILED:
      'Your overall score was below 50%. This attempt does not count toward completion. You may retake the advanced assessment.',
    LT2_SUBMITTED: 'Reflection question generated',
    INTEGRITY_WARNED:
      'Integrity warning recorded. One more violation will void this session.',
    INTEGRITY_FLAGGED: 'Integrity event recorded',
  },
  ONBOARDING: {
    TALENT_COMPLETED: 'Talent onboarding completed',
    EMPLOYER_COMPLETED: 'Employer onboarding completed',
    EMPLOYER_PROFILE_SAVED: 'Profile saved',
    CANDIDATE_COMPLETED: 'Candidate onboarding completed',
    GOAL_SAVED: 'Goal saved',
    TRACK_SAVED: 'Track saved',
    TRACKS_SAVED: 'Role tracks saved',
    PROFILE_SAVED: 'Profile saved',
    TALENT_PROFILE_SAVED: 'Profile saved',
    AVATAR_UPLOADED: 'Avatar uploaded successfully',
    DASHBOARD_PERSONALISED: 'Dashboard personalised',
  },
  COMMON: {
    SUCCESS: 'success',
    API_PROBE: 'I am the NestJS API responding',
  },
  AI_RESOURCES: {
    RETRIEVED: 'Personalized resources retrieved successfully',
  },
  EMPLOYER_DISCOVERY: {
    CANDIDATE_SAVED: 'Candidate saved to shortlist',
    CANDIDATE_REMOVED: 'Candidate removed from shortlist',
    CONTACT_SENT: 'Contact request sent',
  },
  OFFERS: {
    CREATED: 'Offer sent successfully',
    ACCEPTED: 'Offer accepted',
    DECLINED: 'Offer declined',
  },
  EMPLOYER_VERIFICATION: {
    VERIFIED: 'Employer verification complete',
  },
  ADMIN_MANAGEMENT: {
    INVITE_SENT: (email: string) => `Invite sent to ${email}`,
    PASSWORD_RESET_SENT: (email: string) =>
      `Password reset code sent to ${email}`,
    EMAIL_UPDATED: (name: string) => `Email updated for ${name}`,
    ROLE_UPDATED: (name: string) => `Role updated for ${name}`,
    ACCOUNT_DEACTIVATED: 'Account deactivated',
    ACCOUNT_REACTIVATED: 'Account reactivated',
  },
} as const;

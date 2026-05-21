export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

/** Payload for queued or immediate password-reset email send. */
export type PasswordResetEmailPayload = {
  to: string;
  otp: string;
  recipientFirstName: string;
  /** May be a string when job data is deserialized from Redis (BullMQ). */
  expiresAt: Date | string | number;
};

/** Payload for advanced assessment performance notification email. */
export type AssessmentPerformanceEmailPayload = {
  to: string;
  recipientFirstName: string;
  score: number;
  maxScore: number;
  percentage: number;
  tierLabel: string;
};

/** Payload for advanced assessment retake eligibility email. */
export type AdvancedRetakeAvailableEmailPayload = {
  to: string;
  recipientFirstName: string;
};

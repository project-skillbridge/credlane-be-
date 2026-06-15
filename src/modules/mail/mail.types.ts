export type SendMailAttachment = {
  filename: string;
  content: string | Buffer;
  contentId?: string;
};

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: SendMailAttachment[];
};

/** Payload for queued or immediate password-reset email send. */
export type PasswordResetEmailPayload = {
  to: string;
  otp: string;
  recipientFirstName?: string | null;
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

/** Payload for weekly Job Ready candidate digest email (employer). */
export type JobReadyMatchesDigestEmailPayload = {
  to: string;
  recipientFirstName: string;
  matchCount: number;
};

/** Payload for account data export delivery email (with JSON attachment). */
export type DataExportReadyEmailPayload = {
  to: string;
  recipientFirstName: string;
  fileName: string;
  attachmentContent: string | Buffer;
};

/** Internal alert when an assessment question bank cannot fulfil a session. */
export type BankExhaustedAlertPayload = {
  assessmentType: 'skill' | 'advanced';
  detail: string;
  talentProfileId?: string;
  userId?: string;
  track?: string | null;
  verifiedLevel?: string | null;
  expectedQuestions?: number;
  gotQuestions?: number;
};

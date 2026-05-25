export enum NotificationType {
  ADVANCED_ASSESSMENT_SCORE_READY = 'advanced_assessment_score_ready',
  ADVANCED_RETAKE_AVAILABLE = 'advanced_retake_available',
  OFFER_RECEIVED = 'offer_received',
  OFFER_ACCEPTED = 'offer_accepted',
  OFFER_DECLINED = 'offer_declined',
  CONTACT_REQUEST_RECEIVED = 'contact_request_received',
  JOB_READY_MATCHES_AVAILABLE = 'job_ready_matches_available',
}

export const NOTIFICATION_TYPE_VALUES = [
  NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
  NotificationType.ADVANCED_RETAKE_AVAILABLE,
  NotificationType.OFFER_RECEIVED,
  NotificationType.OFFER_ACCEPTED,
  NotificationType.OFFER_DECLINED,
  NotificationType.CONTACT_REQUEST_RECEIVED,
  NotificationType.JOB_READY_MATCHES_AVAILABLE,
] as const;

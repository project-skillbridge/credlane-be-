export enum NotificationType {
  ADVANCED_ASSESSMENT_SCORE_READY = 'advanced_assessment_score_ready',
  ADVANCED_RETAKE_AVAILABLE = 'advanced_retake_available',
}

export const NOTIFICATION_TYPE_VALUES = [
  NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
  NotificationType.ADVANCED_RETAKE_AVAILABLE,
] as const;

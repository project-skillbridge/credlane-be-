import { keysToSnake } from '../../common/utils/case-transform';
import { NotificationType } from '../notifications/notification-type.enum';
import type { NotificationListItem } from '../notifications/notification.types';

export type EmployerNotificationLink = {
  entity_id: string | null;
  entity_type: 'candidate' | 'offer' | 'assessment' | 'discovery' | null;
};

export type EmployerNotificationItem = {
  notification_id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
  link: EmployerNotificationLink | null;
  data: Record<string, unknown> | null;
};

export function mapEmployerNotificationType(type: NotificationType): string {
  if (type === NotificationType.JOB_READY_MATCHES_AVAILABLE) {
    return 'new_matching_talent';
  }
  if (type === NotificationType.OFFER_ACCEPTED) {
    return 'offer_accepted_assessment_unlocked';
  }
  if (type === NotificationType.ASSESSMENT_PASSED) {
    return 'candidate_passed';
  }
  if (type === NotificationType.ASSESSMENT_FAILED) {
    return 'candidate_failed';
  }
  return type;
}

export function buildEmployerNotificationLink(
  data: Record<string, unknown> | null,
): EmployerNotificationLink | null {
  if (!data) {
    return null;
  }

  const offerId = data.offer_id ?? data.offerId;
  if (typeof offerId === 'string' && offerId.length > 0) {
    return { entity_id: offerId, entity_type: 'offer' };
  }

  const assessmentId = data.assessment_id ?? data.assessmentId;
  if (typeof assessmentId === 'string' && assessmentId.length > 0) {
    return { entity_id: assessmentId, entity_type: 'assessment' };
  }

  const candidateUserId = data.candidate_user_id ?? data.candidateUserId;
  if (typeof candidateUserId === 'string' && candidateUserId.length > 0) {
    return { entity_id: candidateUserId, entity_type: 'candidate' };
  }

  const candidateUserIds = data.candidate_user_ids ?? data.candidateUserIds;
  if (Array.isArray(candidateUserIds) && candidateUserIds.length > 0) {
    return { entity_id: null, entity_type: 'discovery' };
  }

  return null;
}

export function toEmployerNotificationItem(
  item: NotificationListItem,
): EmployerNotificationItem {
  return {
    notification_id: item.id,
    type: mapEmployerNotificationType(item.type),
    message: item.body,
    timestamp: item.created_at,
    read: item.is_read,
    link: buildEmployerNotificationLink(item.data),
    data: keysToSnake(item.data),
  };
}

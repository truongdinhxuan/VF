import type { PaginatedResponse, PaginationParams } from './pagination.types';

export const NOTIFICATION_DOMAIN = {
  SUPPLY: 'supply',
} as const;

export const NOTIFICATION_TYPE = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface NotificationArea {
  id: string;
  code: string;
  name: string;
}

export interface NotificationActor {
  id: string;
  display_name: string;
}

export interface NotificationEntity {
  id: string;
  code: string;
  shift_order_sheet_id: string | null;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  domain: string;
  title: string;
  message: string;
  entity_type: string;
  entity: NotificationEntity | null;
  area: NotificationArea | null;
  created_by: NotificationActor | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
}

export interface NotificationListParams extends Partial<PaginationParams> {
  unreadOnly?: boolean;
  domain?: string;
}

export interface NotificationListResponse extends PaginatedResponse<AppNotification> {
  unread_count: number;
}

export interface MarkNotificationReadResult {
  notification_id: string;
  is_read: boolean;
  read_at: string | null;
}

export interface NotificationLiveSignal {
  notification_id: string;
  type: NotificationType;
  domain: string;
  entity_type: string;
  entity_id: string;
  shift_order_sheet_id: string | null;
  title: string;
  message: string;
  created_at: string;
}

export interface StockLiveSignal {
  domain: typeof NOTIFICATION_DOMAIN.SUPPLY;
  type: 'STOCK_CHANGED';
  occurred_at: string;
}

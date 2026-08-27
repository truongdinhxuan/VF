import type { PaginationQuery } from './pagination';

export const NOTIFICATION_DOMAIN = {
  SUPPLY: 'supply',
} as const;

export const NOTIFICATION_TYPE = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface NotificationListQuery extends PaginationQuery {
  unreadOnly?: boolean | string;
  domain?: string;
}

export interface NotificationUserSummary {
  id: string;
  display_name: string;
}

export interface NotificationAreaSummary {
  id: string;
  code: string;
  name: string;
}

export interface NotificationEntitySummary {
  id: string;
  code: string;
  shift_order_sheet_id: string | null;
}

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  domain: string;
  title: string;
  message: string;
  entity_type: string;
  entity: NotificationEntitySummary | null;
  area: NotificationAreaSummary | null;
  created_by: NotificationUserSummary | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
}

export interface SupplyOrderNotificationSource {
  id: string;
  code: string;
  to_area_id: string;
  status_id: string;
  updated_at: string;
  shift_order_sheet_id: string | null;
  status_lookup: {
    code: string;
    name: string;
  };
}

export interface NotificationLiveSignal {
  cursor_id: string;
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

export interface StockChangeCursor {
  cursor_id: string;
  created_at: string;
}

export interface StockLiveSignal {
  domain: typeof NOTIFICATION_DOMAIN.SUPPLY;
  type: 'STOCK_CHANGED';
  occurred_at: string;
}

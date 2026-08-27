import instance from './http';
import type { ApiEnvelope } from '../types/api';
import type {
  MarkNotificationReadResult,
  NotificationListParams,
  NotificationListResponse,
} from '../types/notifications';

export const listNotifications = async (
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<NotificationListResponse> => instance.get<
  NotificationListResponse,
  NotificationListResponse
>('notifications', { params, signal });

export const markNotificationRead = async (
  notificationId: string,
): Promise<MarkNotificationReadResult> => {
  const response = await instance.patch<
    ApiEnvelope<MarkNotificationReadResult>,
    ApiEnvelope<MarkNotificationReadResult>
  >(`notifications/${notificationId}/read`);
  return response.data;
};

export const getNotificationStreamUrl = (): string => {
  const configuredBase = String(import.meta.env.VITE_API_URL ?? '/').trim() || '/';
  const absoluteBase = new URL(configuredBase, window.location.origin);
  const normalizedPath = absoluteBase.pathname.endsWith('/')
    ? absoluteBase.pathname
    : `${absoluteBase.pathname}/`;
  absoluteBase.pathname = `${normalizedPath}notifications/stream`;
  absoluteBase.search = '';
  absoluteBase.hash = '';
  return absoluteBase.toString();
};

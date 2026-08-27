import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getNotificationStreamUrl } from '../api/notifications.service';
import { useAuth } from '../context/AuthContext';
import { queryKeys } from '../lib/queryKeys';
import {
  NOTIFICATION_DOMAIN,
  NOTIFICATION_TYPE,
  type NotificationLiveSignal,
  type StockLiveSignal,
} from '../types/notifications';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'offline';

interface ParsedEvent {
  event: string;
  data: string;
}

const parseSseBlock = (block: string): ParsedEvent | null => {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null;
};

const isLiveSignal = (value: unknown): value is NotificationLiveSignal => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotificationLiveSignal>;
  return typeof candidate.notification_id === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.entity_id === 'string';
};

const isStockLiveSignal = (value: unknown): value is StockLiveSignal => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StockLiveSignal>;
  return candidate.domain === NOTIFICATION_DOMAIN.SUPPLY
    && candidate.type === 'STOCK_CHANGED'
    && typeof candidate.occurred_at === 'string';
};

export const useSupplyRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [toast, setToast] = useState<NotificationLiveSignal | null>(null);
  const seenNotificationIds = useRef(new Set<string>());

  const invalidateSupplyViews = useCallback(async (signal?: NotificationLiveSignal) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftOrderSheets.all }),
    ];
    if (signal?.type === NOTIFICATION_TYPE.ORDER_STATUS_CHANGED) {
      invalidations.push(queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(signal.entity_id),
      }));
    }
    await Promise.all(invalidations);
  }, [queryClient]);

  const invalidateStockAvailability = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.supplyStackOptions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.details }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    let controller: AbortController | undefined;

    const connect = async (): Promise<void> => {
      if (stopped) return;
      const token = localStorage.getItem('access_token');
      if (!token) return;
      controller = new AbortController();
      setConnectionState('connecting');
      try {
        const response = await fetch(getNotificationStreamUrl(), {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`Notification stream failed with HTTP ${response.status}`);
        }

        setConnectionState('connected');
        retryDelay = 1000;
        await Promise.all([invalidateSupplyViews(), invalidateStockAvailability()]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');
            const parsed = parseSseBlock(block);
            if (!parsed || !['notification', 'stock_changed'].includes(parsed.event)) continue;
            let payload: unknown;
            try {
              payload = JSON.parse(parsed.data);
            } catch {
              continue;
            }
            if (parsed.event === 'stock_changed') {
              if (isStockLiveSignal(payload)) await invalidateStockAvailability();
              continue;
            }
            if (!isLiveSignal(payload) || payload.domain !== NOTIFICATION_DOMAIN.SUPPLY) continue;
            await invalidateSupplyViews(payload);
            if (!seenNotificationIds.current.has(payload.notification_id)) {
              seenNotificationIds.current.add(payload.notification_id);
              setToast(payload);
            }
          }
        }
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === 'AbortError')) {
          setConnectionState('offline');
        }
      } finally {
        if (!stopped) {
          reconnectTimer = setTimeout(() => {
            void connect();
          }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 10_000);
        }
      }
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [invalidateStockAvailability, invalidateSupplyViews, user]);

  return {
    connectionState: user ? connectionState : 'idle',
    toast: user ? toast : null,
    dismissToast: () => setToast(null),
  };
};

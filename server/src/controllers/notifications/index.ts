import type { FastifyReply, FastifyRequest } from 'fastify';
import type { NotificationListQuery } from '../../interfaces/notifications';
import { NOTIFICATION_DOMAIN } from '../../interfaces/notifications';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { permissionRequirementSatisfied } from '../../middleware/auth';
import {
  NotificationServiceError,
  NotificationsService,
} from '../../services/notifications.service';
import {
  isPaginatedResult,
  PaginationValidationError,
  toPaginatedResponse,
} from '../../utils/pagination';

const respond = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
) => {
  try {
    const result = await handler();
    if (isPaginatedResult(result)) {
      const response = toPaginatedResponse(result);
      const unreadCount = (result as { unreadCount?: number }).unreadCount ?? 0;
      return reply.send({ ...response, unread_count: unreadCount });
    }
    return reply.send({ data: result });
  } catch (error) {
    if (error instanceof PaginationValidationError
        || error instanceof NotificationServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const listNotifications = (request: FastifyRequest, reply: FastifyReply) =>
  respond(request, reply, () => new NotificationsService(request.server).list(
    request.user.id,
    request.query as NotificationListQuery,
  ));

export const markNotificationRead = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respond(request, reply, () => new NotificationsService(request.server).markRead(
  request.user.id,
  (request.params as { id: string }).id,
));

const writeEvent = (
  reply: FastifyReply,
  event: string,
  payload: unknown,
): void => {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const streamNotifications = (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const requestOrigin = request.headers.origin;
  const allowedOrigin = process.env.ORIGIN_URL?.trim();
  if (requestOrigin && allowedOrigin && requestOrigin === allowedOrigin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', requestOrigin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Vary', 'Origin');
  }

  reply.hijack();
  reply.raw.statusCode = 200;
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();
  reply.raw.write('retry: 3000\n\n');

  const service = new NotificationsService(request.server);
  let cursorCreatedAt = new Date().toISOString();
  let cursorId = '';
  let stockCursorCreatedAt = cursorCreatedAt;
  let stockCursorId = '';
  let polling = false;
  let closed = false;
  const canReceiveStockSignals = permissionRequirementSatisfied(
    request.user,
    PERMISSION_CODE.SUPPLY_ORDER_CREATE,
  );

  writeEvent(reply, 'connected', { connected_at: cursorCreatedAt });

  const poll = async () => {
    if (closed || polling) return;
    polling = true;
    try {
      const signals = await service.listLiveSignals(
        request.user.id,
        cursorCreatedAt,
        cursorId,
      );
      for (const signal of signals) {
        if (closed) break;
        const { cursor_id: cursorIdForRow, ...payload } = signal;
        writeEvent(reply, 'notification', payload);
        cursorCreatedAt = signal.created_at;
        cursorId = cursorIdForRow;
      }
      if (canReceiveStockSignals && !closed) {
        const stockChange = await service.getLatestStockChange(
          stockCursorCreatedAt,
          stockCursorId,
        );
        if (stockChange) {
          stockCursorCreatedAt = stockChange.created_at;
          stockCursorId = stockChange.cursor_id;
          writeEvent(reply, 'stock_changed', {
            domain: NOTIFICATION_DOMAIN.SUPPLY,
            type: 'STOCK_CHANGED',
            occurred_at: stockChange.created_at,
          });
        }
      }
    } catch (error) {
      request.log.error(error, 'Notification SSE poll failed');
      if (!closed) writeEvent(reply, 'sync_error', { retryable: true });
    } finally {
      polling = false;
    }
  };

  const pollTimer = setInterval(() => void poll(), 1500);
  const heartbeatTimer = setInterval(() => {
    if (!closed) reply.raw.write(': keep-alive\n\n');
  }, 15000);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  };
  request.raw.once('close', cleanup);
  reply.raw.once('close', cleanup);
};

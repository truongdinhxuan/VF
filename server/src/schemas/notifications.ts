import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

export const NOTIFICATION_SORT_FIELDS = ['created_at'] as const;

export const notificationListSchema = createListQuerySchema(
  NOTIFICATION_SORT_FIELDS,
  {
    unreadOnly: { type: 'boolean' },
    domain: { type: 'string', minLength: 1, maxLength: 50 },
  },
);

export const notificationReadSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const notificationStreamSchema = {
  produces: ['text/event-stream'],
};

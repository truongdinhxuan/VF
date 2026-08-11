import type { FastifySchema } from 'fastify';
import { createListQuerySchema } from './pagination';
import { idParamsSchema } from './master-data';

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableText = {
  anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }],
} as const;

export const MILKRUN_TRIP_SORT_FIELDS = [
  'code',
  'created_at',
  'updated_at',
  'time_start',
  'time_arrived',
] as const;

export const milkrunTripListSchema = createListQuerySchema(
  MILKRUN_TRIP_SORT_FIELDS,
  {
    status: { type: 'string', minLength: 1, maxLength: 100 },
    statusId: uuid,
    shopId: uuid,
    tripTypeId: uuid,
    driverId: uuid,
    dateFrom: { type: 'string', format: 'date-time' },
    dateTo: { type: 'string', format: 'date-time' },
  },
);

export const milkrunTripIdSchema = idParamsSchema;

export const milkrunTripCreateSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['shop_id', 'trip_type_id', 'items'],
    properties: {
      shop_id: uuid,
      trip_type_id: uuid,
      attachment_url: nullableText,
      note: nullableText,
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['rack_id', 'quantity'],
          properties: {
            rack_id: uuid,
            quantity: { type: 'number', exclusiveMinimum: 0 },
            note: nullableText,
          },
        },
      },
    },
  },
};

export const milkrunTripCancelSchema: FastifySchema = {
  ...idParamsSchema,
  body: {
    type: 'object',
    additionalProperties: false,
    properties: { reason: nullableText },
  },
};


import type { FastifySchema } from 'fastify';
import { STOCK_TRANSACTION_TYPES } from '../domain/enums';
import { STOCK_ADJUSTMENT_TYPES } from '../domain/stockRules';

const uuid = { type: 'string', format: 'uuid' } as const;
const optionalBoolean = {
  anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
} as const;

export const stockIdParamsSchema: FastifySchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const stockBalanceListSchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      supply_id: uuid,
      area_id: uuid,
      storage_location_id: uuid,
      low_stock: optionalBoolean,
    },
  },
};

export const stockTransactionListSchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      supply_id: uuid,
      area_id: uuid,
      type: { type: 'string', enum: [...STOCK_TRANSACTION_TYPES] },
      order_id: uuid,
      date_from: { type: 'string', minLength: 10, maxLength: 40 },
      date_to: { type: 'string', minLength: 10, maxLength: 40 },
    },
  },
};

export const stockAdjustmentCreateSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: [
      'supply_id',
      'area_id',
      'storage_location_id',
      'type',
      'quantity',
      'reason',
    ],
    properties: {
      supply_id: uuid,
      area_id: uuid,
      storage_location_id: uuid,
      type: { type: 'string', enum: [...STOCK_ADJUSTMENT_TYPES] },
      quantity: { type: 'number', exclusiveMinimum: 0 },
      reason: { type: 'string', minLength: 1, maxLength: 2000 },
      note: {
        anyOf: [
          { type: 'string', maxLength: 2000 },
          { type: 'null' },
        ],
      },
    },
  },
};

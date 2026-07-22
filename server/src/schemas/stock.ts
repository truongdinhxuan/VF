import type { FastifySchema } from 'fastify';
import { STOCK_TRANSACTION_TYPES } from '../domain/enums';
import { STOCK_ADJUSTMENT_TYPES } from '../domain/stockRules';
import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

export const STOCK_BALANCE_SORT_FIELDS = [
  'id', 'quantity', 'supply_id', 'area_id', 'storage_location_id',
  'created_at', 'updated_at',
] as const;
export const STOCK_TRANSACTION_SORT_FIELDS = [
  'id', 'type', 'quantity', 'before_quantity', 'after_quantity', 'supply_id',
  'area_id', 'storage_location_id', 'created_by', 'created_at',
] as const;

export const stockIdParamsSchema: FastifySchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const stockBalanceListSchema = createListQuerySchema(
  STOCK_BALANCE_SORT_FIELDS,
  {
    supply_id: uuid,
    supplyId: uuid,
    area_id: uuid,
    areaId: uuid,
    storage_location_id: uuid,
    storageLocationId: uuid,
  },
);

export const stockTransactionListSchema = createListQuerySchema(
  STOCK_TRANSACTION_SORT_FIELDS,
  {
    supply_id: uuid,
    supplyId: uuid,
    area_id: uuid,
    areaId: uuid,
    storageLocationId: uuid,
    createdBy: uuid,
    type: { type: 'string', enum: [...STOCK_TRANSACTION_TYPES] },
    order_id: uuid,
    date_from: { type: 'string', minLength: 10, maxLength: 40 },
    date_to: { type: 'string', minLength: 10, maxLength: 40 },
    dateFrom: { type: 'string', minLength: 10, maxLength: 40 },
    dateTo: { type: 'string', minLength: 10, maxLength: 40 },
  },
);

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

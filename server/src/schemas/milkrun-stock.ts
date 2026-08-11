import type { FastifySchema } from 'fastify';
import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

export const MILKRUN_STOCK_BALANCE_SORT_FIELDS = [
  'quantity',
  'created_at',
  'updated_at',
] as const;

export const MILKRUN_STOCK_TRANSACTION_SORT_FIELDS = [
  'quantity',
  'before_quantity',
  'after_quantity',
  'created_at',
] as const;

export const milkrunStockBalanceListSchema = createListQuerySchema(
  MILKRUN_STOCK_BALANCE_SORT_FIELDS,
  {
    rackId: uuid,
    areaId: uuid,
  },
);

export const milkrunStockTransactionListSchema = createListQuerySchema(
  MILKRUN_STOCK_TRANSACTION_SORT_FIELDS,
  {
    rackId: uuid,
    areaId: uuid,
    transactionTypeId: uuid,
    adjustmentReasonId: uuid,
    createdBy: uuid,
    tripId: uuid,
    dateFrom: { type: 'string', format: 'date-time' },
    dateTo: { type: 'string', format: 'date-time' },
  },
);

export const milkrunStockAdjustmentCreateSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: [
      'rack_id',
      'transaction_type_id',
      'adjustment_reason_id',
      'quantity',
    ],
    properties: {
      rack_id: uuid,
      transaction_type_id: uuid,
      adjustment_reason_id: uuid,
      quantity: { type: 'number', exclusiveMinimum: 0 },
      reason_note: {
        anyOf: [
          { type: 'string', maxLength: 2000 },
          { type: 'null' },
        ],
      },
    },
  },
};

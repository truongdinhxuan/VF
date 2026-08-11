import type { FastifySchema } from 'fastify';
import { createListQuerySchema } from './pagination';
import { idParamsSchema } from './master-data';

const active = { type: 'boolean' } as const;
const optionalBoolean = {
  anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
} as const;
const uuid = { type: 'string', format: 'uuid' } as const;
const nullableUuid = { anyOf: [uuid, { type: 'null' }] } as const;
const nullableText = {
  anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }],
} as const;
const code = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  pattern: '^[A-Za-z][A-Za-z0-9_]*$',
} as const;
const name = { type: 'string', minLength: 1, maxLength: 255 } as const;

const objectBody = (
  properties: Record<string, unknown>,
  required: string[] = [],
): FastifySchema['body'] => ({
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  ...(required.length ? { required } : {}),
  properties,
});

const lifecycleQuery = {
  isActive: optionalBoolean,
  isDeleted: optionalBoolean,
};

export const MILKRUN_RACK_SORT_FIELDS = [
  'code', 'name', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_SHOP_SORT_FIELDS = [
  'code', 'name', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_TRIP_TYPE_SORT_FIELDS = [
  'code', 'name', 'is_system', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_TRIP_STATUS_SORT_FIELDS = [
  'sort_order', 'code', 'name', 'is_system', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_VEHICLE_SORT_FIELDS = [
  'code', 'plate_number', 'driver_id', 'name', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_STOCK_TRANSACTION_TYPE_SORT_FIELDS = [
  'code', 'name', 'effect', 'is_system', 'is_active', 'created_at', 'updated_at',
] as const;
export const MILKRUN_ADJUSTMENT_REASON_SORT_FIELDS = [
  'code', 'name', 'is_active', 'created_at', 'updated_at',
] as const;

export const milkrunRackListSchema = createListQuerySchema(
  MILKRUN_RACK_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunShopListSchema = createListQuerySchema(
  MILKRUN_SHOP_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunTripTypeListSchema = createListQuerySchema(
  MILKRUN_TRIP_TYPE_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunTripStatusListSchema = createListQuerySchema(
  MILKRUN_TRIP_STATUS_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunVehicleListSchema = createListQuerySchema(
  MILKRUN_VEHICLE_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunStockTransactionTypeListSchema = createListQuerySchema(
  MILKRUN_STOCK_TRANSACTION_TYPE_SORT_FIELDS,
  lifecycleQuery,
);
export const milkrunAdjustmentReasonListSchema = createListQuerySchema(
  MILKRUN_ADJUSTMENT_REASON_SORT_FIELDS,
  lifecycleQuery,
);

const rackProperties = {
  code,
  name,
  image_url: nullableText,
  is_active: active,
};
const descriptiveProperties = {
  code,
  name,
  description: nullableText,
  is_active: active,
};
const tripStatusProperties = {
  ...descriptiveProperties,
  sort_order: { type: 'integer', minimum: 0 },
};
const vehicleProperties = {
  code,
  plate_number: { type: 'string', minLength: 1, maxLength: 100 },
  driver_id: nullableUuid,
  name: nullableText,
  is_active: active,
};
const transactionTypeProperties = {
  code,
  name,
  effect: { type: 'string', enum: ['INCREASE', 'DECREASE', 'NEUTRAL'] },
  requires_reason: { type: 'boolean' },
  is_active: active,
};

const createSchema = (
  properties: Record<string, unknown>,
  required: string[],
): FastifySchema => ({ body: objectBody(properties, required) });
const updateSchema = (properties: Record<string, unknown>): FastifySchema => ({
  ...idParamsSchema,
  body: objectBody(properties),
});

export const milkrunRackCreateSchema = createSchema(rackProperties, ['code', 'name']);
export const milkrunRackUpdateSchema = updateSchema(rackProperties);
export const milkrunShopCreateSchema = createSchema(descriptiveProperties, ['code', 'name']);
export const milkrunShopUpdateSchema = updateSchema(descriptiveProperties);
export const milkrunTripTypeCreateSchema = createSchema(descriptiveProperties, ['code', 'name']);
export const milkrunTripTypeUpdateSchema = updateSchema(descriptiveProperties);
export const milkrunTripStatusCreateSchema = createSchema(
  tripStatusProperties,
  ['code', 'name', 'sort_order'],
);
export const milkrunTripStatusUpdateSchema = updateSchema(tripStatusProperties);
export const milkrunVehicleCreateSchema = createSchema(
  vehicleProperties,
  ['code', 'plate_number'],
);
export const milkrunVehicleUpdateSchema = updateSchema(vehicleProperties);
export const milkrunStockTransactionTypeCreateSchema = createSchema(
  transactionTypeProperties,
  ['code', 'name', 'effect'],
);
export const milkrunStockTransactionTypeUpdateSchema = updateSchema(
  transactionTypeProperties,
);
export const milkrunAdjustmentReasonCreateSchema = createSchema(
  descriptiveProperties,
  ['code', 'name'],
);
export const milkrunAdjustmentReasonUpdateSchema = updateSchema(
  descriptiveProperties,
);

export { idParamsSchema as milkrunMasterIdSchema };

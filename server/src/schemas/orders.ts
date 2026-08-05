import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

const orderItemProperties = {
  supply_id: uuid,
  provider_id: uuid,
  unit_id: uuid,
  quantity_requested: { type: 'number', exclusiveMinimum: 0 },
  note: {
    anyOf: [
      { type: 'string', maxLength: 2000 },
      { type: 'null' },
    ],
  },
} as const;

const orderItems = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['supply_id', 'provider_id', 'quantity_requested'],
    properties: orderItemProperties,
  },
} as const;

export const orderCreateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['from_area_id', 'to_area_id', 'order_list'],
    properties: {
      from_area_id: uuid,
      to_area_id: uuid,
      note: { type: 'string', maxLength: 2000 },
      order_list: orderItems,
    },
  },
};

export const orderPatchSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      note: { type: 'string', maxLength: 2000 },
      order_list: orderItems,
    },
  },
};

export const ORDER_SORT_FIELDS = [
  'id', 'code', 'status', 'status_id', 'created_at', 'updated_at', 'submitted_at',
  'approved_at', 'received_at',
] as const;

export const orderListSchema = createListQuerySchema(ORDER_SORT_FIELDS, {
  status: { type: 'string', minLength: 1, maxLength: 100 },
  from_area_id: uuid,
  to_area_id: uuid,
  date: { type: 'string', minLength: 10, maxLength: 10 },
  createdBy: uuid,
  areaId: uuid,
  dateFrom: { type: 'string', minLength: 10, maxLength: 40 },
  dateTo: { type: 'string', minLength: 10, maxLength: 40 },
});

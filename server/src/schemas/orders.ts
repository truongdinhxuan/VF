import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

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

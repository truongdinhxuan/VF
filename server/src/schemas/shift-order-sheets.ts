import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;

export const SHIFT_ORDER_SHEET_SORT_FIELDS = [
  'work_date',
  'created_at',
  'updated_at',
] as const;

export const shiftOrderSheetListSchema = createListQuerySchema(
  SHIFT_ORDER_SHEET_SORT_FIELDS,
  {
    workDate: { type: 'string', format: 'date' },
    workShiftId: uuid,
    leaderId: uuid,
    areaId: uuid,
  },
);

export const shiftOrderSheetDetailSchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const shiftOrderSheetExportSchema = {
  params: shiftOrderSheetDetailSchema.params,
  produces: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

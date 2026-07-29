import { createListQuerySchema } from './pagination';

export const LOOKUP_SORT_FIELDS = [
  'id',
  'code',
  'name',
  'sort_order',
  'is_system',
  'is_active',
  'created_at',
  'updated_at',
] as const;

const optionalBoolean = {
  anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
} as const;

export const lookupListSchema = createListQuerySchema(LOOKUP_SORT_FIELDS, {
  isActive: optionalBoolean,
  effect: { type: 'string', enum: ['INCREASE', 'DECREASE', 'NEUTRAL'] },
  requiresReason: optionalBoolean,
});

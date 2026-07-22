import type { FastifySchema } from 'fastify';
import { ROLE_NAMES } from '../domain/enums';
import { createListQuerySchema } from './pagination';

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableText = {
  anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }],
} as const;
const active = { type: 'boolean' } as const;
const optionalBoolean = {
  anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
} as const;
const legacySearch = { type: 'string', maxLength: 100 } as const;

export const ROLE_SORT_FIELDS = ['id', 'role_name'] as const;
export const POSITION_SORT_FIELDS = ['id', 'position_name'] as const;
export const AREA_SORT_FIELDS = ['id', 'code', 'name', 'is_active'] as const;
export const CATEGORY_SORT_FIELDS = [
  'id', 'code', 'description', 'is_active', 'created_at', 'updated_at',
] as const;
export const UNIT_SORT_FIELDS = [
  'id', 'code', 'symbol', 'is_active', 'created_at', 'updated_at',
] as const;
export const SUPPLY_SORT_FIELDS = [
  'id', 'code', 'description', 'min_stock', 'max_stock', 'safety_stock',
  'is_active', 'created_at', 'updated_at',
] as const;
export const STORAGE_LOCATION_SORT_FIELDS = [
  'id', 'code', 'name', 'area_id', 'is_active',
] as const;

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

export const idParamsSchema: FastifySchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const roleListQuerySchema = createListQuerySchema(ROLE_SORT_FIELDS);
export const searchListQuerySchema = createListQuerySchema(POSITION_SORT_FIELDS, {
  q: legacySearch,
});
export const areaListQuerySchema = createListQuerySchema(AREA_SORT_FIELDS, {
  q: legacySearch,
  is_active: optionalBoolean,
  isActive: optionalBoolean,
});
export const categoryListQuerySchema = createListQuerySchema(CATEGORY_SORT_FIELDS, {
  q: legacySearch,
  is_active: optionalBoolean,
  isActive: optionalBoolean,
});
export const unitListQuerySchema = createListQuerySchema(UNIT_SORT_FIELDS, {
  q: legacySearch,
  is_active: optionalBoolean,
  isActive: optionalBoolean,
});

export const roleCreateSchema: FastifySchema = {
  body: objectBody(
    { role_name: { type: 'string', enum: [...ROLE_NAMES] } },
    ['role_name'],
  ),
};

export const roleUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody({ role_name: { type: 'string', enum: [...ROLE_NAMES] } }),
};

export const positionCreateSchema: FastifySchema = {
  body: objectBody(
    { position_name: { type: 'string', minLength: 1, maxLength: 255 } },
    ['position_name'],
  ),
};

export const positionUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody({ position_name: { type: 'string', minLength: 1, maxLength: 255 } }),
};

const areaProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  name: { type: 'string', minLength: 1, maxLength: 255 },
  is_active: active,
} as const;

export const areaCreateSchema: FastifySchema = {
  body: objectBody(areaProperties, ['code', 'name']),
};

export const areaUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(areaProperties),
};

const categoryProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  description: nullableText,
  is_active: active,
} as const;

export const categoryCreateSchema: FastifySchema = {
  body: objectBody(categoryProperties, ['code']),
};

export const categoryUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(categoryProperties),
};

const unitProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  symbol: { type: 'string', minLength: 1, maxLength: 100 },
  is_active: active,
} as const;

export const unitCreateSchema: FastifySchema = {
  body: objectBody(unitProperties, ['code', 'symbol']),
};

export const unitUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(unitProperties),
};

const nullableNumber = {
  anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
} as const;
const supplyProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  description: nullableText,
  category_id: uuid,
  unit_id: uuid,
  min_stock: nullableNumber,
  max_stock: nullableNumber,
  safety_stock: nullableNumber,
  image_url: nullableText,
  is_active: active,
} as const;

export const supplyCreateSchema: FastifySchema = {
  body: objectBody(
    supplyProperties,
    ['code', 'category_id', 'unit_id'],
  ),
};

export const supplyUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(supplyProperties),
};

export const supplyListQuerySchema = createListQuerySchema(SUPPLY_SORT_FIELDS, {
  q: legacySearch,
  category_id: uuid,
  categoryId: uuid,
  unitId: uuid,
  is_active: optionalBoolean,
  isActive: optionalBoolean,
  isDeleted: optionalBoolean,
});

const storageLocationProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  area_id: uuid,
  name: nullableText,
  is_active: active,
} as const;

export const storageLocationCreateSchema: FastifySchema = {
  body: objectBody(storageLocationProperties, ['code', 'area_id']),
};

export const storageLocationUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(storageLocationProperties),
};

export const storageLocationListQuerySchema = createListQuerySchema(
  STORAGE_LOCATION_SORT_FIELDS,
  {
    area_id: uuid,
    areaId: uuid,
    q: legacySearch,
    is_active: optionalBoolean,
    isActive: optionalBoolean,
  },
);

import type { FastifySchema } from 'fastify';
import { ROLE_NAMES } from '../domain/enums';

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableText = {
  anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }],
} as const;
const active = { type: 'boolean' } as const;

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

export const activeListQuerySchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_active: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }] },
      q: { type: 'string', maxLength: 100 },
    },
  },
};

export const searchListQuerySchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 100 },
    },
  },
};

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
  name: { type: 'string', minLength: 1, maxLength: 255 },
  description: nullableText,
  is_active: active,
} as const;

export const categoryCreateSchema: FastifySchema = {
  body: objectBody(categoryProperties, ['code', 'name']),
};

export const categoryUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(categoryProperties),
};

const unitProperties = {
  code: { type: 'string', minLength: 1, maxLength: 100 },
  symbol: { type: 'string', minLength: 1, maxLength: 100 },
  name: nullableText,
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
  short_text: { type: 'string', minLength: 1, maxLength: 255 },
  translator_text: nullableText,
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
    ['code', 'short_text', 'category_id', 'unit_id'],
  ),
};

export const supplyUpdateSchema: FastifySchema = {
  ...idParamsSchema,
  body: objectBody(supplyProperties),
};

export const supplyListQuerySchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 100 },
      category_id: uuid,
      is_active: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }] },
    },
  },
};

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

export const storageLocationListQuerySchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      area_id: uuid,
      q: { type: 'string', maxLength: 100 },
      is_active: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }] },
    },
  },
};

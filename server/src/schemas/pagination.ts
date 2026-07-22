import type { FastifySchema } from 'fastify';

export const paginationQueryProperties = (sortBy: readonly string[]) => ({
  page: { type: 'integer', minimum: 1, default: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  search: { type: 'string', maxLength: 100 },
  sortBy: { type: 'string', enum: [...sortBy] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
});

export const createListQuerySchema = (
  sortBy: readonly string[],
  properties: Record<string, unknown> = {},
): FastifySchema => ({
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...paginationQueryProperties(sortBy),
      ...properties,
    },
  },
});

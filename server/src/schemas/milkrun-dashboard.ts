import type { FastifySchema } from 'fastify';

const uuid = { type: 'string', format: 'uuid' } as const;

export const milkrunDashboardSchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      dateFrom: { type: 'string', format: 'date-time' },
      dateTo: { type: 'string', format: 'date-time' },
      driverId: uuid,
      shopId: uuid,
      statusId: uuid,
    },
  },
};


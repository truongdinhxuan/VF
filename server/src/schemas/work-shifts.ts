import type { FastifySchema } from 'fastify';

const uuid = { type: 'string', format: 'uuid' } as const;

export const userWorkShiftAssignmentListSchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    required: ['user_id'],
    properties: { user_id: uuid },
  },
};

export const assignUserWorkShiftSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['user_id', 'work_shift_id', 'effective_from'],
    properties: {
      user_id: uuid,
      work_shift_id: uuid,
      effective_from: { type: 'string', format: 'date-time' },
    },
  },
};

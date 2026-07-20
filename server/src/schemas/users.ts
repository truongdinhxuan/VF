import type { FastifySchema } from 'fastify';

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableUuid = { anyOf: [uuid, { type: 'null' }] } as const;
const nullableText = {
  anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }],
} as const;

const userProfileProperties = {
  email: { type: 'string', format: 'email', maxLength: 320 },
  first_name: { type: 'string', minLength: 1, maxLength: 255 },
  last_name: { type: 'string', minLength: 1, maxLength: 255 },
  vinfast_id: { type: 'integer' },
  phone_number: nullableText,
  avatar_url: nullableText,
  role_id: uuid,
  position_id: nullableUuid,
  area_id: uuid,
  managed_by_user_id: nullableUuid,
} as const;

const userMutableProperties = {
  ...userProfileProperties,
  is_active: { type: 'boolean' },
  is_verified: { type: 'boolean' },
} as const;

export const createUserSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: [
      'email',
      'password',
      'first_name',
      'last_name',
      'vinfast_id',
      'role_id',
      'area_id',
    ],
    properties: {
      ...userProfileProperties,
      password: { type: 'string', minLength: 6 },
    },
  },
};

export const updateUserSchema: FastifySchema = {
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
    properties: userMutableProperties,
  },
};

export const userIdParamsSchema: FastifySchema = {
  params: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: uuid },
  },
};

export const updatePasswordSchema: FastifySchema = {
  ...userIdParamsSchema,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['currentPassword', 'newPassword', 'confirmNewPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1 },
      newPassword: { type: 'string', minLength: 9 },
      confirmNewPassword: { type: 'string', minLength: 9 },
    },
  },
};

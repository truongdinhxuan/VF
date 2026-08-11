import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { PermissionCode } from '../domain/permission-codes';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
    };
    user: {
      sub: string;
      id: string;
      email?: string;
      areaId: string;
      roleIds: string[];
      permissions: PermissionCode[];
      isSystemAdmin: boolean;
    };
  }
}

export default fp(async (fastify) => {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('APP_JWT_SECRET must contain at least 32 characters');
  }

  await fastify.register(jwt, {
    secret,
    sign: {
      expiresIn: process.env.APP_JWT_EXPIRES_IN ?? '8h',
    },
  });
});

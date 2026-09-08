import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { PermissionCode } from '../domain/permission-codes';
import { getAuthConfiguration } from '../config/auth';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      sid: string;
    };
    user: {
      sub: string;
      sid: string;
      exp: number;
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
  const config = getAuthConfiguration();

  await fastify.register(jwt, {
    secret,
    sign: {
      algorithm: 'HS256',
      expiresIn: config.accessTokenTtl,
      iss: config.issuer,
      aud: config.audience,
    },
    verify: {
      algorithms: ['HS256'],
      allowedIss: config.issuer,
      allowedAud: config.audience,
    },
  });
});

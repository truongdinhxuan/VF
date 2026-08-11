import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PermissionCode } from '../domain/permission-codes';
import {
  AuthorizationError,
  getEffectivePermissions,
  hasPermission,
} from '../services/authorization.service';

export interface PermissionRequirement {
  allOf?: readonly PermissionCode[];
  anyOf?: readonly PermissionCode[];
}

const sendAuthorizationError = (
  reply: FastifyReply,
  error: AuthorizationError,
) => reply.code(error.statusCode).send({ error: error.message });

export const verifyToken = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (request.method === 'OPTIONS') return;

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Vui lòng cung cấp Bearer token hợp lệ' });
  }

  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Token đã hết hạn hoặc không hợp lệ' });
  }

  try {
    const access = await getEffectivePermissions(request.server, request.user.sub);
    request.user = {
      sub: access.userId,
      id: access.userId,
      email: access.email,
      areaId: access.areaId,
      roleIds: access.roleIds,
      permissions: access.permissions,
      isSystemAdmin: access.isSystemAdmin,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return sendAuthorizationError(reply, error);
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ trong quá trình xác thực' });
  }
};

export const permissionRequirementSatisfied = (
  access: Pick<FastifyRequest['user'], 'permissions' | 'isSystemAdmin'>,
  requirement: PermissionCode | PermissionRequirement,
): boolean => {
  if (access.isSystemAdmin) return true;
  if (typeof requirement === 'string') return hasPermission(access, requirement);

  const allOf = requirement.allOf ?? [];
  const anyOf = requirement.anyOf ?? [];
  if (allOf.length === 0 && anyOf.length === 0) return false;

  const hasAll = allOf.every((permission) => hasPermission(access, permission));
  const hasAny = anyOf.length === 0
    || anyOf.some((permission) => hasPermission(access, permission));
  return hasAll && hasAny;
};

export const requirePermission = (
  requirement: PermissionCode | PermissionRequirement,
) => async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.method === 'OPTIONS') return;
  if (!request.user?.id) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  if (!permissionRequirementSatisfied(request.user, requirement)) {
    return reply.code(403).send({
      error: 'Bạn không có permission để truy cập chức năng này',
    });
  }
};

/**
 * Reserved for workbook endpoints whose API contract is system-ADMIN-only but
 * has no dedicated permission code in PermissionsCatalog. It relies on the
 * already-resolved exact ADMIN code + is_system flag and never checks a role
 * display name in the route.
 */
export const requireSystemAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (request.method === 'OPTIONS') return;
  if (!request.user?.id) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  if (!request.user.isSystemAdmin) {
    return reply.code(403).send({
      error: 'Chức năng này chỉ dành cho system ADMIN',
    });
  }
};

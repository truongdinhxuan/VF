import type { FastifyPluginAsync } from 'fastify';
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  updateRole,
} from '../../controllers/roles';
import { getRolePermissions, replaceRolePermissions } from '../../controllers/rbac';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  idParamsSchema,
  roleListQuerySchema,
  roleCreateSchema,
  roleUpdateSchema,
} from '../../schemas/master-data';
import { replaceRolePermissionsSchema, rolePermissionParamsSchema } from '../../schemas/rbac';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_READ)],
      schema: roleListQuerySchema,
    },
    listRoles,
  );
  fastify.get(
    '/:id/permissions',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_READ)],
      schema: rolePermissionParamsSchema,
    },
    getRolePermissions,
  );
  fastify.put(
    '/:id/permissions',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_ASSIGN_PERMISSION)],
      schema: replaceRolePermissionsSchema,
    },
    replaceRolePermissions,
  );
  fastify.get(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_READ)],
      schema: idParamsSchema,
    },
    getRole,
  );
  fastify.post(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_CREATE)],
      schema: roleCreateSchema,
    },
    createRole,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_UPDATE)],
      schema: roleUpdateSchema,
    },
    updateRole,
  );
  fastify.delete(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_UPDATE)],
      schema: idParamsSchema,
    },
    deleteRole,
  );
};

export default roleRoutes;

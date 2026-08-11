import type { FastifyPluginAsync } from 'fastify';
import { listPermissions } from '../../controllers/rbac';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { permissionListSchema } from '../../schemas/rbac';

const permissionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_ROLE_READ)],
    schema: permissionListSchema,
  }, listPermissions);
};

export default permissionRoutes;

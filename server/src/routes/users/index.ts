import type { FastifyPluginAsync } from 'fastify';
import { createUser } from '../../controllers/users/create';
import { deactivateUser } from '../../controllers/users/deactivate';
import { getUserById } from '../../controllers/users/detail';
import { userIndex } from '../../controllers/users/list';
import { userUpdate } from '../../controllers/users/update';
import { userUpdatePassword } from '../../controllers/users/update-password';
import { getUserRoles, replaceUserRoles } from '../../controllers/rbac';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  createUserSchema,
  updatePasswordSchema,
  updateUserSchema,
  userListSchema,
  userIdParamsSchema,
} from '../../schemas/users';
import { replaceUserRolesSchema, userRoleParamsSchema } from '../../schemas/rbac';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_READ)],
      schema: userListSchema,
    },
    userIndex,
  );
  fastify.get(
    '/:id/roles',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_READ)],
      schema: userRoleParamsSchema,
    },
    getUserRoles,
  );
  fastify.put(
    '/:id/roles',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_ASSIGN_ROLE)],
      schema: replaceUserRolesSchema,
    },
    replaceUserRoles,
  );
  fastify.get(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_READ)],
      schema: userIdParamsSchema,
    },
    getUserById,
  );
  fastify.post(
    '/',
    {
      preHandler: [verifyToken, requirePermission({
        allOf: [PERMISSION_CODE.ADMIN_USER_CREATE, PERMISSION_CODE.ADMIN_USER_ASSIGN_ROLE],
      })],
      schema: createUserSchema,
    },
    createUser,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_UPDATE)],
      schema: updateUserSchema,
    },
    userUpdate,
  );
  fastify.delete(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.ADMIN_USER_UPDATE)],
      schema: userIdParamsSchema,
    },
    deactivateUser,
  );
  fastify.patch(
    '/:id/password',
    {
      preHandler: verifyToken,
      schema: updatePasswordSchema,
    },
    userUpdatePassword,
  );
};

export default userRoutes;

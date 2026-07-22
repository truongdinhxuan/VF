import type { FastifyPluginAsync } from 'fastify';
import { createUser } from '../../controllers/users/create';
import { deactivateUser } from '../../controllers/users/deactivate';
import { getUserById } from '../../controllers/users/detail';
import { userIndex } from '../../controllers/users/list';
import { userUpdate } from '../../controllers/users/update';
import { userUpdatePassword } from '../../controllers/users/update-password';
import { ROLE_NAMES } from '../../domain/enums';
import { USER_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  createUserSchema,
  updatePasswordSchema,
  updateUserSchema,
  userListSchema,
  userIdParamsSchema,
} from '../../schemas/users';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(USER_MANAGER_ROLES), schema: userListSchema },
    userIndex,
  );
  fastify.get(
    '/:id',
    {
      preHandler: verifyTokenAndRole(USER_MANAGER_ROLES),
      schema: userIdParamsSchema,
    },
    getUserById,
  );
  fastify.post(
    '/',
    {
      preHandler: verifyTokenAndRole(USER_MANAGER_ROLES),
      schema: createUserSchema,
    },
    createUser,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: verifyTokenAndRole(USER_MANAGER_ROLES),
      schema: updateUserSchema,
    },
    userUpdate,
  );
  fastify.delete(
    '/:id',
    {
      preHandler: verifyTokenAndRole(USER_MANAGER_ROLES),
      schema: userIdParamsSchema,
    },
    deactivateUser,
  );
  fastify.patch(
    '/:id/password',
    {
      preHandler: verifyTokenAndRole(ROLE_NAMES),
      schema: updatePasswordSchema,
    },
    userUpdatePassword,
  );
};

export default userRoutes;

import type { FastifyPluginAsync } from 'fastify';
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  updateRole,
} from '../../controllers/roles';
import { ROLE_NAMES } from '../../domain/enums';
import { SYSTEM_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  idParamsSchema,
  roleCreateSchema,
  roleUpdateSchema,
} from '../../schemas/master-data';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: verifyTokenAndRole(ROLE_NAMES) }, listRoles);
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getRole,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: roleCreateSchema },
    createRole,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: roleUpdateSchema },
    updateRole,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: idParamsSchema },
    deleteRole,
  );
};

export default roleRoutes;

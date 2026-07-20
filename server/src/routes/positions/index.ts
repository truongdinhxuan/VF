import type { FastifyPluginAsync } from 'fastify';
import {
  createPosition,
  deletePosition,
  getPosition,
  listPositions,
  updatePosition,
} from '../../controllers/positions';
import { ROLE_NAMES } from '../../domain/enums';
import { SYSTEM_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  idParamsSchema,
  positionCreateSchema,
  positionUpdateSchema,
  searchListQuerySchema,
} from '../../schemas/master-data';

const positionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: searchListQuerySchema },
    listPositions,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getPosition,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: positionCreateSchema },
    createPosition,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: positionUpdateSchema },
    updatePosition,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: idParamsSchema },
    deletePosition,
  );
};

export default positionRoutes;

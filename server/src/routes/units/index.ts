import type { FastifyPluginAsync } from 'fastify';
import {
  createUnit,
  deleteUnit,
  getUnit,
  listUnits,
  updateUnit,
} from '../../controllers/units';
import { ROLE_NAMES } from '../../domain/enums';
import { MASTER_DATA_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  unitListQuerySchema,
  idParamsSchema,
  unitCreateSchema,
  unitUpdateSchema,
} from '../../schemas/master-data';

const unitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: unitListQuerySchema },
    listUnits,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getUnit,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: unitCreateSchema },
    createUnit,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: unitUpdateSchema },
    updateUnit,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: idParamsSchema },
    deleteUnit,
  );
};

export default unitRoutes;

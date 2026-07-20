import type { FastifyPluginAsync } from 'fastify';
import {
  createSupply,
  deleteSupply,
  getSupply,
  listSupplies,
  updateSupply,
} from '../../controllers/supplies';
import { ROLE_NAMES } from '../../domain/enums';
import { MASTER_DATA_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  idParamsSchema,
  supplyCreateSchema,
  supplyListQuerySchema,
  supplyUpdateSchema,
} from '../../schemas/master-data';

const supplyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: supplyListQuerySchema },
    listSupplies,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getSupply,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: supplyCreateSchema },
    createSupply,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: supplyUpdateSchema },
    updateSupply,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: idParamsSchema },
    deleteSupply,
  );
};

export default supplyRoutes;

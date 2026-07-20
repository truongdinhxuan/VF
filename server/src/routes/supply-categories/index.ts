import type { FastifyPluginAsync } from 'fastify';
import {
  createSupplyCategory,
  deleteSupplyCategory,
  getSupplyCategory,
  listSupplyCategories,
  updateSupplyCategory,
} from '../../controllers/supply-categories';
import { ROLE_NAMES } from '../../domain/enums';
import { MASTER_DATA_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  activeListQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  idParamsSchema,
} from '../../schemas/master-data';

const supplyCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: activeListQuerySchema },
    listSupplyCategories,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getSupplyCategory,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: categoryCreateSchema },
    createSupplyCategory,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: categoryUpdateSchema },
    updateSupplyCategory,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: idParamsSchema },
    deleteSupplyCategory,
  );
};

export default supplyCategoryRoutes;

import type { FastifyPluginAsync } from 'fastify';
import {
  createSupplyCategory,
  deleteSupplyCategory,
  getSupplyCategory,
  listSupplyCategories,
  updateSupplyCategory,
} from '../../controllers/supply-categories';
import { ROLE_CODES } from '../../domain/enums';
import { MASTER_DATA_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  categoryListQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  idParamsSchema,
} from '../../schemas/master-data';

const supplyCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_CODES), schema: categoryListQuerySchema },
    listSupplyCategories,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_CODES), schema: idParamsSchema },
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

import type { FastifyPluginAsync } from 'fastify';
import {
  createSupplyCategory,
  deleteSupplyCategory,
  getSupplyCategory,
  listSupplyCategories,
  updateSupplyCategory,
} from '../../controllers/supply-categories';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  categoryListQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  idParamsSchema,
} from '../../schemas/master-data';

const supplyCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  const catalogReadPermission = [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)];
  fastify.get(
    '/',
    { preHandler: catalogReadPermission, schema: categoryListQuerySchema },
    listSupplyCategories,
  );
  fastify.get(
    '/:id',
    { preHandler: catalogReadPermission, schema: idParamsSchema },
    getSupplyCategory,
  );
  fastify.post(
    '/',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)], schema: categoryCreateSchema },
    createSupplyCategory,
  );
  fastify.patch(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)], schema: categoryUpdateSchema },
    updateSupplyCategory,
  );
  fastify.delete(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)], schema: idParamsSchema },
    deleteSupplyCategory,
  );
};

export default supplyCategoryRoutes;

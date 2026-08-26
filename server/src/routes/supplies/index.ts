import type { FastifyPluginAsync } from 'fastify';
import {
  createSupply,
  deleteSupply,
  getSupply,
  listSupplies,
  listSupplyProviders,
  listSupplyStackOptions,
  updateSupply,
} from '../../controllers/supplies';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  idParamsSchema,
  supplyCreateSchema,
  supplyListQuerySchema,
  supplyProviderListQuerySchema,
  supplyStackOptionsSchema,
  supplyUpdateSchema,
} from '../../schemas/master-data';

const supplyRoutes: FastifyPluginAsync = async (fastify) => {
  const catalogReadPermission = [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)];
  fastify.get(
    '/',
    { preHandler: catalogReadPermission, schema: supplyListQuerySchema },
    listSupplies,
  );
  fastify.get(
    '/:id/providers',
    {
      preHandler: catalogReadPermission,
      schema: supplyProviderListQuerySchema,
    },
    listSupplyProviders,
  );
  fastify.get(
    '/:id/stack-options',
    {
      preHandler: [
        verifyToken,
        requirePermission(PERMISSION_CODE.SUPPLY_ORDER_CREATE),
      ],
      schema: supplyStackOptionsSchema,
    },
    listSupplyStackOptions,
  );
  fastify.get(
    '/:id',
    { preHandler: catalogReadPermission, schema: idParamsSchema },
    getSupply,
  );
  fastify.post(
    '/',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)], schema: supplyCreateSchema },
    createSupply,
  );
  fastify.patch(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)], schema: supplyUpdateSchema },
    updateSupply,
  );
  fastify.delete(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)], schema: idParamsSchema },
    deleteSupply,
  );
};

export default supplyRoutes;

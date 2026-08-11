import type { FastifyPluginAsync } from 'fastify';
import {
  createUnit,
  deleteUnit,
  getUnit,
  listUnits,
  updateUnit,
} from '../../controllers/units';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  unitListQuerySchema,
  idParamsSchema,
  unitCreateSchema,
  unitUpdateSchema,
} from '../../schemas/master-data';

const unitRoutes: FastifyPluginAsync = async (fastify) => {
  const catalogReadPermission = [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)];
  fastify.get(
    '/',
    { preHandler: catalogReadPermission, schema: unitListQuerySchema },
    listUnits,
  );
  fastify.get(
    '/:id',
    { preHandler: catalogReadPermission, schema: idParamsSchema },
    getUnit,
  );
  fastify.post(
    '/',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)], schema: unitCreateSchema },
    createUnit,
  );
  fastify.patch(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)], schema: unitUpdateSchema },
    updateUnit,
  );
  fastify.delete(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)], schema: idParamsSchema },
    deleteUnit,
  );
};

export default unitRoutes;

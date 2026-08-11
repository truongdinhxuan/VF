import type { FastifyPluginAsync } from 'fastify';
import {
  createArea,
  deleteArea,
  getArea,
  listAreas,
  updateArea,
} from '../../controllers/areas';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  areaListQuerySchema,
  areaCreateSchema,
  areaUpdateSchema,
  idParamsSchema,
} from '../../schemas/master-data';

const areaRoutes: FastifyPluginAsync = async (fastify) => {
  const catalogReadPermission = [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)];
  fastify.get(
    '/',
    { preHandler: catalogReadPermission, schema: areaListQuerySchema },
    listAreas,
  );
  fastify.get(
    '/:id',
    { preHandler: catalogReadPermission, schema: idParamsSchema },
    getArea,
  );
  fastify.post(
    '/',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)], schema: areaCreateSchema },
    createArea,
  );
  fastify.patch(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)], schema: areaUpdateSchema },
    updateArea,
  );
  fastify.delete(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)], schema: idParamsSchema },
    deleteArea,
  );
};

export default areaRoutes;

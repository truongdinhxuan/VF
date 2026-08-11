import type { FastifyPluginAsync } from 'fastify';
import {
  createStorageLocation,
  deleteStorageLocation,
  getStorageLocation,
  listStorageLocations,
  updateStorageLocation,
} from '../../controllers/storage-locations';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  idParamsSchema,
  storageLocationCreateSchema,
  storageLocationListQuerySchema,
  storageLocationUpdateSchema,
} from '../../schemas/master-data';

const storageLocationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)],
      schema: storageLocationListQuerySchema,
    },
    listStorageLocations,
  );
  fastify.get(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)],
      schema: idParamsSchema,
    },
    getStorageLocation,
  );
  fastify.post(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)],
      schema: storageLocationCreateSchema,
    },
    createStorageLocation,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)],
      schema: storageLocationUpdateSchema,
    },
    updateStorageLocation,
  );
  fastify.delete(
    '/:id',
    { preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)], schema: idParamsSchema },
    deleteStorageLocation,
  );
};

export default storageLocationRoutes;

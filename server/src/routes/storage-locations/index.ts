import type { FastifyPluginAsync } from 'fastify';
import {
  createStorageLocation,
  deleteStorageLocation,
  getStorageLocation,
  listStorageLocations,
  updateStorageLocation,
} from '../../controllers/storage-locations';
import {
  MASTER_DATA_MANAGER_ROLES,
  STOCK_VIEWER_ROLES,
} from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
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
      preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
      schema: storageLocationListQuerySchema,
    },
    listStorageLocations,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES), schema: idParamsSchema },
    getStorageLocation,
  );
  fastify.post(
    '/',
    {
      preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES),
      schema: storageLocationCreateSchema,
    },
    createStorageLocation,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES),
      schema: storageLocationUpdateSchema,
    },
    updateStorageLocation,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(MASTER_DATA_MANAGER_ROLES), schema: idParamsSchema },
    deleteStorageLocation,
  );
};

export default storageLocationRoutes;

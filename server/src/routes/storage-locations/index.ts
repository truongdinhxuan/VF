import type { FastifyPluginAsync } from 'fastify';
import { listStorageLocations } from '../../controllers/storage-locations';
import { MATERIAL_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';

const storageLocationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(MATERIAL_ROLES) },
    listStorageLocations,
  );
};

export default storageLocationRoutes;

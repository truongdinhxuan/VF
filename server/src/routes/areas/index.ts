import type { FastifyPluginAsync } from 'fastify';
import { listAreas } from '../../controllers/catalog';
import { ROLE_NAMES } from '../../domain/enums';
import { verifyTokenAndRole } from '../../middleware/auth';

const areaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: verifyTokenAndRole(ROLE_NAMES) }, listAreas);
};

export default areaRoutes;

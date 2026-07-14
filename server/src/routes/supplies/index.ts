import type { FastifyPluginAsync } from 'fastify';
import { listSupplies } from '../../controllers/supplies';
import { ROLE_NAMES } from '../../domain/enums';
import { verifyTokenAndRole } from '../../middleware/auth';

const supplyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: verifyTokenAndRole(ROLE_NAMES) }, listSupplies);
};

export default supplyRoutes;

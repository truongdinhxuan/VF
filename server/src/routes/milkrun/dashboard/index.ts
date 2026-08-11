import type { FastifyPluginAsync } from 'fastify';
import { getMilkrunDashboard } from '../../../controllers/milkrun-dashboard';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import { milkrunDashboardSchema } from '../../../schemas/milkrun-dashboard';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [
      verifyToken,
      requirePermission(PERMISSION_CODE.MILKRUN_DASHBOARD_READ),
    ],
    schema: milkrunDashboardSchema,
  }, getMilkrunDashboard);
};

export default routes;

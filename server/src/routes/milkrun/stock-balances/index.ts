import type { FastifyPluginAsync } from 'fastify';
import { listMilkrunStockBalances } from '../../../controllers/milkrun-stock';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import { milkrunStockBalanceListSchema } from '../../../schemas/milkrun-stock';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [
      verifyToken,
      requirePermission(PERMISSION_CODE.MILKRUN_STOCK_READ),
    ],
    schema: milkrunStockBalanceListSchema,
  }, listMilkrunStockBalances);
};

export default routes;


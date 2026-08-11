import type { FastifyPluginAsync } from 'fastify';
import { listMilkrunStockTransactions } from '../../../controllers/milkrun-stock';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import { milkrunStockTransactionListSchema } from '../../../schemas/milkrun-stock';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [
      verifyToken,
      requirePermission(PERMISSION_CODE.MILKRUN_STOCK_READ),
    ],
    schema: milkrunStockTransactionListSchema,
  }, listMilkrunStockTransactions);
};

export default routes;


import type { FastifyPluginAsync } from 'fastify';
import {
  getStockTransaction,
  listStockTransactions,
} from '../../controllers/stock-transactions';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  stockIdParamsSchema,
  stockTransactionListSchema,
} from '../../schemas/stock';

const stockTransactionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_STOCK_READ)],
      schema: stockTransactionListSchema,
    },
    listStockTransactions,
  );
  fastify.get(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_STOCK_READ)],
      schema: stockIdParamsSchema,
    },
    getStockTransaction,
  );
};

export default stockTransactionRoutes;

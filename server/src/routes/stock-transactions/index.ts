import type { FastifyPluginAsync } from 'fastify';
import {
  getStockTransaction,
  listStockTransactions,
} from '../../controllers/stock-transactions';
import { STOCK_VIEWER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  stockIdParamsSchema,
  stockTransactionListSchema,
} from '../../schemas/stock';

const stockTransactionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
      schema: stockTransactionListSchema,
    },
    listStockTransactions,
  );
  fastify.get(
    '/:id',
    {
      preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
      schema: stockIdParamsSchema,
    },
    getStockTransaction,
  );
};

export default stockTransactionRoutes;

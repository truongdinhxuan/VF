import type { FastifyPluginAsync } from 'fastify';
import {
  getStockBalance,
  listStockBalances,
} from '../../controllers/stock-balances';
import { STOCK_VIEWER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  stockBalanceListSchema,
  stockIdParamsSchema,
} from '../../schemas/stock';

const stockBalanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
      schema: stockBalanceListSchema,
    },
    listStockBalances,
  );
  fastify.get(
    '/:id',
    {
      preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
      schema: stockIdParamsSchema,
    },
    getStockBalance,
  );
};

export default stockBalanceRoutes;

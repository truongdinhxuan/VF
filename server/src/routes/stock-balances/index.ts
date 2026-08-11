import type { FastifyPluginAsync } from 'fastify';
import {
  getStockBalance,
  listStockBalances,
} from '../../controllers/stock-balances';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  stockBalanceListSchema,
  stockIdParamsSchema,
} from '../../schemas/stock';

const stockBalanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_STOCK_READ)],
      schema: stockBalanceListSchema,
    },
    listStockBalances,
  );
  fastify.get(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_STOCK_READ)],
      schema: stockIdParamsSchema,
    },
    getStockBalance,
  );
};

export default stockBalanceRoutes;

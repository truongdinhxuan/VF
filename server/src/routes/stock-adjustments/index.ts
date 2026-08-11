import type { FastifyPluginAsync } from 'fastify';
import { createStockAdjustment } from '../../controllers/stock-adjustments';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { stockAdjustmentCreateSchema } from '../../schemas/stock';

const stockAdjustmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_STOCK_ADJUST)],
      schema: stockAdjustmentCreateSchema,
    },
    createStockAdjustment,
  );
};

export default stockAdjustmentRoutes;

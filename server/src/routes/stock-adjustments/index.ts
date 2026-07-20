import type { FastifyPluginAsync } from 'fastify';
import { createStockAdjustment } from '../../controllers/stock-adjustments';
import { STOCK_MUTATOR_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import { stockAdjustmentCreateSchema } from '../../schemas/stock';

const stockAdjustmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      preHandler: verifyTokenAndRole(STOCK_MUTATOR_ROLES),
      schema: stockAdjustmentCreateSchema,
    },
    createStockAdjustment,
  );
};

export default stockAdjustmentRoutes;

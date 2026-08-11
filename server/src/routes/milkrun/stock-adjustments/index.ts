import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunStockAdjustment } from '../../../controllers/milkrun-stock';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import { milkrunStockAdjustmentCreateSchema } from '../../../schemas/milkrun-stock';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', {
    preHandler: [
      verifyToken,
      requirePermission(PERMISSION_CODE.MILKRUN_STOCK_ADJUST),
    ],
    schema: milkrunStockAdjustmentCreateSchema,
  }, createMilkrunStockAdjustment);
};

export default routes;

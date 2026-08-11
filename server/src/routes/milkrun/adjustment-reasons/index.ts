import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunAdjustmentReasonCreateSchema,
  milkrunAdjustmentReasonListSchema,
  milkrunAdjustmentReasonUpdateSchema,
  milkrunMasterIdSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('adjustment_reasons');
  const read = [
    verifyToken,
    requirePermission({ anyOf: [
      PERMISSION_CODE.MILKRUN_STOCK_READ,
      PERMISSION_CODE.MILKRUN_STOCK_ADJUST,
    ] }),
  ];
  const mutate = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_STOCK_ADJUST)];

  fastify.get('/', { preHandler: read, schema: milkrunAdjustmentReasonListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post(
    '/',
    { preHandler: mutate, schema: milkrunAdjustmentReasonCreateSchema },
    handlers.create,
  );
  fastify.patch(
    '/:id',
    { preHandler: mutate, schema: milkrunAdjustmentReasonUpdateSchema },
    handlers.update,
  );
  fastify.patch(
    '/:id/deactivate',
    { preHandler: mutate, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

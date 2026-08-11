import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import {
  requirePermission,
  requireSystemAdmin,
  verifyToken,
} from '../../../middleware/auth';
import {
  milkrunMasterIdSchema,
  milkrunStockTransactionTypeCreateSchema,
  milkrunStockTransactionTypeListSchema,
  milkrunStockTransactionTypeUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('stock_transaction_types');
  const read = [
    verifyToken,
    requirePermission({ anyOf: [
      PERMISSION_CODE.MILKRUN_STOCK_READ,
      PERMISSION_CODE.MILKRUN_STOCK_ADJUST,
    ] }),
  ];
  const mutate = [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_STOCK_ADJUST),
    requireSystemAdmin,
  ];

  fastify.get('/', { preHandler: read, schema: milkrunStockTransactionTypeListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post(
    '/',
    { preHandler: mutate, schema: milkrunStockTransactionTypeCreateSchema },
    handlers.create,
  );
  fastify.patch(
    '/:id',
    { preHandler: mutate, schema: milkrunStockTransactionTypeUpdateSchema },
    handlers.update,
  );
  fastify.patch(
    '/:id/deactivate',
    { preHandler: mutate, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

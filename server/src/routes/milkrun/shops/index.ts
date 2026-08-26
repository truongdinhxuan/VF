import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunMasterIdSchema,
  milkrunShopCreateSchema,
  milkrunShopListSchema,
  milkrunShopUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('shops');
  const read = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_SHOP_READ)];
  const create = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_SHOP_CREATE)];
  const update = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_SHOP_UPDATE)];
  const deactivate = [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_SHOP_DEACTIVATE),
  ];

  fastify.get('/', { preHandler: read, schema: milkrunShopListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post('/', { preHandler: create, schema: milkrunShopCreateSchema }, handlers.create);
  fastify.patch('/:id', { preHandler: update, schema: milkrunShopUpdateSchema }, handlers.update);
  fastify.patch(
    '/:id/deactivate',
    { preHandler: deactivate, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

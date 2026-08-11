import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunMasterIdSchema,
  milkrunRackCreateSchema,
  milkrunRackListSchema,
  milkrunRackUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('racks');
  const read = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_RACK_READ)];
  const create = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_RACK_CREATE)];
  const update = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_RACK_UPDATE)];

  fastify.get('/', { preHandler: read, schema: milkrunRackListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post('/', { preHandler: create, schema: milkrunRackCreateSchema }, handlers.create);
  fastify.patch('/:id', { preHandler: update, schema: milkrunRackUpdateSchema }, handlers.update);
  fastify.patch(
    '/:id/deactivate',
    { preHandler: update, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

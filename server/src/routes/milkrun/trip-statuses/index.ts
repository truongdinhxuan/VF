import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunMasterIdSchema,
  milkrunTripStatusCreateSchema,
  milkrunTripStatusListSchema,
  milkrunTripStatusUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('trip_statuses');
  const read = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_STATUS_READ)];
  const create = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_STATUS_CREATE)];
  const update = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_STATUS_UPDATE)];
  const deactivate = [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_TRIP_STATUS_DEACTIVATE),
  ];

  fastify.get('/', { preHandler: read, schema: milkrunTripStatusListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post('/', { preHandler: create, schema: milkrunTripStatusCreateSchema }, handlers.create);
  fastify.patch('/:id', { preHandler: update, schema: milkrunTripStatusUpdateSchema }, handlers.update);
  fastify.patch(
    '/:id/deactivate',
    { preHandler: deactivate, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

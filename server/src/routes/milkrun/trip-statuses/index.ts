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
  milkrunTripStatusCreateSchema,
  milkrunTripStatusListSchema,
  milkrunTripStatusUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('trip_statuses');
  const read = [
    verifyToken,
    requirePermission({ anyOf: [
      PERMISSION_CODE.MILKRUN_TRIP_READ_OWN,
      PERMISSION_CODE.MILKRUN_TRIP_READ_ALL,
      PERMISSION_CODE.MILKRUN_TRIP_CREATE,
    ] }),
  ];
  const mutate = [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE),
    requireSystemAdmin,
  ];

  fastify.get('/', { preHandler: read, schema: milkrunTripStatusListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post('/', { preHandler: mutate, schema: milkrunTripStatusCreateSchema }, handlers.create);
  fastify.patch('/:id', { preHandler: mutate, schema: milkrunTripStatusUpdateSchema }, handlers.update);
  fastify.patch(
    '/:id/deactivate',
    { preHandler: mutate, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

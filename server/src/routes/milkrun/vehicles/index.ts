import type { FastifyPluginAsync } from 'fastify';
import { createMilkrunMasterHandlers } from '../../../controllers/milkrun-master-data';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunMasterIdSchema,
  milkrunVehicleCreateSchema,
  milkrunVehicleListSchema,
  milkrunVehicleUpdateSchema,
} from '../../../schemas/milkrun-master-data';

const routes: FastifyPluginAsync = async (fastify) => {
  const handlers = createMilkrunMasterHandlers('vehicles');
  const read = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_VEHICLE_READ)];
  const assign = [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_VEHICLE_ASSIGN)];

  fastify.get('/', { preHandler: read, schema: milkrunVehicleListSchema }, handlers.list);
  fastify.get('/:id', { preHandler: read, schema: milkrunMasterIdSchema }, handlers.get);
  fastify.post('/', { preHandler: assign, schema: milkrunVehicleCreateSchema }, handlers.create);
  fastify.patch('/:id', { preHandler: assign, schema: milkrunVehicleUpdateSchema }, handlers.update);
  fastify.patch(
    '/:id/deactivate',
    { preHandler: assign, schema: milkrunMasterIdSchema },
    handlers.deactivate,
  );
};

export default routes;

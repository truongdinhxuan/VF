import type { FastifyPluginAsync } from 'fastify';
import {
  arriveMilkrunTrip,
  cancelMilkrunTrip,
  createMilkrunTrip,
  getMilkrunTrip,
  listMilkrunTrips,
  startMilkrunTrip,
} from '../../../controllers/milkrun-trips';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  milkrunTripCancelSchema,
  milkrunTripCreateSchema,
  milkrunTripIdSchema,
  milkrunTripListSchema,
} from '../../../schemas/milkrun-trips';

const routes: FastifyPluginAsync = async (fastify) => {
  const read = [verifyToken, requirePermission({ anyOf: [
    PERMISSION_CODE.MILKRUN_TRIP_READ_OWN,
    PERMISSION_CODE.MILKRUN_TRIP_READ_ALL,
  ] })];

  fastify.get('/', { preHandler: read, schema: milkrunTripListSchema }, listMilkrunTrips);
  fastify.get('/:id', { preHandler: read, schema: milkrunTripIdSchema }, getMilkrunTrip);
  fastify.post('/', {
    preHandler: [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE)],
    schema: milkrunTripCreateSchema,
  }, createMilkrunTrip);
  fastify.post('/:id/start', {
    preHandler: [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_START)],
    schema: milkrunTripIdSchema,
  }, startMilkrunTrip);
  fastify.post('/:id/arrive', {
    preHandler: [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_ARRIVE)],
    schema: milkrunTripIdSchema,
  }, arriveMilkrunTrip);
  fastify.post('/:id/cancel', {
    preHandler: [verifyToken, requirePermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE)],
    schema: milkrunTripCancelSchema,
  }, cancelMilkrunTrip);
};

export default routes;

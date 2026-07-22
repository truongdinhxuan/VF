import type { FastifyPluginAsync } from 'fastify';
import {
  approveOrder,
  cancelOrder,
  completeOrder,
  createOrder,
  getOrder,
  issueOrder,
  listOrders,
  patchOrder,
  receiveOrder,
  rejectOrder,
  submitOrder,
} from '../../controllers/orders';
import { ROLE_NAMES } from '../../domain/enums';
import {
  ORDER_APPROVER_ROLES,
  ORDER_ISSUER_ROLES,
  PACKING_ROLE,
} from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import { orderListSchema } from '../../schemas/orders';

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { preHandler: verifyTokenAndRole([PACKING_ROLE]) }, createOrder);
  fastify.patch('/:id', { preHandler: verifyTokenAndRole([PACKING_ROLE]) }, patchOrder);
  fastify.post(
    '/:id/submit',
    { preHandler: verifyTokenAndRole([PACKING_ROLE]) },
    submitOrder,
  );
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: orderListSchema },
    listOrders,
  );
  fastify.get('/:id', { preHandler: verifyTokenAndRole(ROLE_NAMES) }, getOrder);
  fastify.post(
    '/:id/approve',
    { preHandler: verifyTokenAndRole(ORDER_APPROVER_ROLES) },
    approveOrder,
  );
  fastify.post(
    '/:id/reject',
    { preHandler: verifyTokenAndRole(ORDER_APPROVER_ROLES) },
    rejectOrder,
  );
  fastify.post(
    '/:id/issue',
    { preHandler: verifyTokenAndRole(ORDER_ISSUER_ROLES) },
    issueOrder,
  );
  fastify.post(
    '/:id/receive',
    { preHandler: verifyTokenAndRole([PACKING_ROLE]) },
    receiveOrder,
  );
  fastify.post(
    '/:id/complete',
    { preHandler: verifyTokenAndRole(ORDER_ISSUER_ROLES) },
    completeOrder,
  );
  fastify.post(
    '/:id/cancel',
    { preHandler: verifyTokenAndRole([PACKING_ROLE]) },
    cancelOrder,
  );
};

export default orderRoutes;

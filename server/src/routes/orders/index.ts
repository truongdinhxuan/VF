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
import { ROLE_CODE, ROLE_CODES } from '../../domain/enums';
import {
  ORDER_APPROVER_ROLES,
  ORDER_ISSUER_ROLES,
  PACKING_ROLE,
} from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  orderCreateSchema,
  orderListSchema,
  orderPatchSchema,
} from '../../schemas/orders';

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  const ownerRoles = [PACKING_ROLE, ROLE_CODE.ADMIN];
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(ownerRoles), schema: orderCreateSchema },
    createOrder,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(ownerRoles), schema: orderPatchSchema },
    patchOrder,
  );
  fastify.post(
    '/:id/submit',
    { preHandler: verifyTokenAndRole(ownerRoles) },
    submitOrder,
  );
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_CODES), schema: orderListSchema },
    listOrders,
  );
  fastify.get('/:id', { preHandler: verifyTokenAndRole(ROLE_CODES) }, getOrder);
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
    { preHandler: verifyTokenAndRole(ownerRoles) },
    receiveOrder,
  );
  fastify.post(
    '/:id/complete',
    { preHandler: verifyTokenAndRole(ORDER_ISSUER_ROLES) },
    completeOrder,
  );
  fastify.post(
    '/:id/cancel',
    { preHandler: verifyTokenAndRole(ownerRoles) },
    cancelOrder,
  );
};

export default orderRoutes;

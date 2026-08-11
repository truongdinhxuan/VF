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
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  orderCreateSchema,
  orderListSchema,
  orderPatchSchema,
} from '../../schemas/orders';

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  const ownerPermission = [
    verifyToken,
    requirePermission(PERMISSION_CODE.SUPPLY_ORDER_CREATE),
  ];
  const orderReadPermission = [
    verifyToken,
    requirePermission({
      anyOf: [
        PERMISSION_CODE.SUPPLY_ORDER_CREATE,
        PERMISSION_CODE.SUPPLY_ORDER_APPROVE,
      ],
    }),
  ];
  const orderReviewPermission = [
    verifyToken,
    requirePermission(PERMISSION_CODE.SUPPLY_ORDER_APPROVE),
  ];
  const orderIssuePermission = [
    verifyToken,
    requirePermission(PERMISSION_CODE.SUPPLY_ORDER_ISSUE),
  ];
  fastify.post(
    '/',
    { preHandler: ownerPermission, schema: orderCreateSchema },
    createOrder,
  );
  fastify.patch(
    '/:id',
    { preHandler: ownerPermission, schema: orderPatchSchema },
    patchOrder,
  );
  fastify.post(
    '/:id/submit',
    { preHandler: ownerPermission },
    submitOrder,
  );
  fastify.get(
    '/',
    { preHandler: orderReadPermission, schema: orderListSchema },
    listOrders,
  );
  fastify.get('/:id', { preHandler: orderReadPermission }, getOrder);
  fastify.post(
    '/:id/approve',
    { preHandler: orderReviewPermission },
    approveOrder,
  );
  fastify.post(
    '/:id/reject',
    { preHandler: orderReviewPermission },
    rejectOrder,
  );
  fastify.post(
    '/:id/issue',
    { preHandler: orderIssuePermission },
    issueOrder,
  );
  fastify.post(
    '/:id/receive',
    { preHandler: ownerPermission },
    receiveOrder,
  );
  fastify.post(
    '/:id/complete',
    { preHandler: orderIssuePermission },
    completeOrder,
  );
  fastify.post(
    '/:id/cancel',
    { preHandler: ownerPermission },
    cancelOrder,
  );
};

export default orderRoutes;

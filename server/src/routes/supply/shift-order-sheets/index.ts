import type { FastifyPluginAsync } from 'fastify';
import {
  exportShiftOrderSheet,
  getShiftOrderSheet,
  listShiftOrderSheets,
} from '../../../controllers/shift-order-sheets';
import { ORDER_READ_PERMISSIONS } from '../../../domain/order-access';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  shiftOrderSheetDetailSchema,
  shiftOrderSheetExportSchema,
  shiftOrderSheetListSchema,
} from '../../../schemas/shift-order-sheets';

const routes: FastifyPluginAsync = async (fastify) => {
  const readPermission = [
    verifyToken,
    requirePermission({
      anyOf: [
        ...ORDER_READ_PERMISSIONS,
      ],
    }),
  ];

  fastify.get('/', {
    preHandler: readPermission,
    schema: shiftOrderSheetListSchema,
  }, listShiftOrderSheets);

  fastify.get('/:id', {
    preHandler: readPermission,
    schema: shiftOrderSheetDetailSchema,
  }, getShiftOrderSheet);

  fastify.get('/:id/export', {
    preHandler: readPermission,
    schema: shiftOrderSheetExportSchema,
  }, exportShiftOrderSheet);
};

export default routes;

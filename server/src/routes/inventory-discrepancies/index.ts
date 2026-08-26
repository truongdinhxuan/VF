import type { FastifyPluginAsync } from 'fastify';
import { resolveInventoryDiscrepancy } from '../../controllers/inventory-discrepancies';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { inventoryDiscrepancyResolveSchema } from '../../schemas/stock';

const inventoryDiscrepancyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/:id/resolve',
    {
      preHandler: [
        verifyToken,
        requirePermission(PERMISSION_CODE.SUPPLY_DISCREPANCY_RESOLVE),
      ],
      schema: inventoryDiscrepancyResolveSchema,
    },
    resolveInventoryDiscrepancy,
  );
};

export default inventoryDiscrepancyRoutes;

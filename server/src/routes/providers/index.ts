import type { FastifyPluginAsync } from 'fastify';
import {
  createProvider,
  deactivateProvider,
  getProvider,
  listProviders,
  updateProvider,
} from '../../controllers/providers';
import { PERMISSION_CODE } from '../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../middleware/auth';
import {
  idParamsSchema,
  providerCreateSchema,
  providerListQuerySchema,
  providerUpdateSchema,
} from '../../schemas/master-data';

const providerRoutes: FastifyPluginAsync = async (fastify) => {
  const providerReadPermission = [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_READ)];
  fastify.get(
    '/',
    {
      preHandler: providerReadPermission,
      schema: providerListQuerySchema,
    },
    listProviders,
  );
  fastify.get(
    '/:id',
    {
      preHandler: providerReadPermission,
      schema: idParamsSchema,
    },
    getProvider,
  );
  fastify.post(
    '/',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_CREATE)],
      schema: providerCreateSchema,
    },
    createProvider,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE)],
      schema: providerUpdateSchema,
    },
    updateProvider,
  );
  fastify.patch(
    '/:id/deactivate',
    {
      preHandler: [verifyToken, requirePermission(PERMISSION_CODE.SUPPLY_CATALOG_DELETE)],
      schema: idParamsSchema,
    },
    deactivateProvider,
  );
};

export default providerRoutes;

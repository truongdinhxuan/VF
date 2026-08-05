import type { FastifyPluginAsync } from 'fastify';
import {
  createProvider,
  deactivateProvider,
  getProvider,
  listProviders,
  updateProvider,
} from '../../controllers/providers';
import {
  PROVIDER_MANAGER_ROLES,
  PROVIDER_VIEWER_ROLES,
} from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  idParamsSchema,
  providerCreateSchema,
  providerListQuerySchema,
  providerUpdateSchema,
} from '../../schemas/master-data';

const providerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: verifyTokenAndRole(PROVIDER_VIEWER_ROLES),
      schema: providerListQuerySchema,
    },
    listProviders,
  );
  fastify.get(
    '/:id',
    {
      preHandler: verifyTokenAndRole(PROVIDER_VIEWER_ROLES),
      schema: idParamsSchema,
    },
    getProvider,
  );
  fastify.post(
    '/',
    {
      preHandler: verifyTokenAndRole(PROVIDER_MANAGER_ROLES),
      schema: providerCreateSchema,
    },
    createProvider,
  );
  fastify.patch(
    '/:id',
    {
      preHandler: verifyTokenAndRole(PROVIDER_MANAGER_ROLES),
      schema: providerUpdateSchema,
    },
    updateProvider,
  );
  fastify.patch(
    '/:id/deactivate',
    {
      preHandler: verifyTokenAndRole(PROVIDER_MANAGER_ROLES),
      schema: idParamsSchema,
    },
    deactivateProvider,
  );
};

export default providerRoutes;

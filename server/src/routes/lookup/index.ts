import type { FastifyPluginAsync } from 'fastify';
import { listLookup } from '../../controllers/lookups';
import { ROLE_CODES } from '../../domain/enums';
import {
  STOCK_VIEWER_ROLES,
  SYSTEM_MANAGER_ROLES,
} from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import { lookupListSchema } from '../../schemas/lookups';

const lookupRoutes: FastifyPluginAsync = async (fastify) => {
  const allLoggedIn = {
    preHandler: verifyTokenAndRole(ROLE_CODES),
    schema: lookupListSchema,
  };
  const stockUsers = {
    preHandler: verifyTokenAndRole(STOCK_VIEWER_ROLES),
    schema: lookupListSchema,
  };
  const systemManagers = {
    preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES),
    schema: lookupListSchema,
  };

  fastify.get(
    '/order-statuses',
    allLoggedIn,
    listLookup('order_statuses'),
  );
  fastify.get(
    '/stock-transaction-types',
    stockUsers,
    listLookup('stock_transaction_types'),
  );
  fastify.get(
    '/adjustment-reasons',
    stockUsers,
    listLookup('adjustment_reasons'),
  );
  fastify.get(
    '/order-revision-actions',
    systemManagers,
    listLookup('order_revision_actions'),
  );
};

export default lookupRoutes;

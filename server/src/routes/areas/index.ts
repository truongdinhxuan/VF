import type { FastifyPluginAsync } from 'fastify';
import {
  createArea,
  deleteArea,
  getArea,
  listAreas,
  updateArea,
} from '../../controllers/areas';
import { ROLE_NAMES } from '../../domain/enums';
import { SYSTEM_MANAGER_ROLES } from '../../domain/permissions';
import { verifyTokenAndRole } from '../../middleware/auth';
import {
  areaListQuerySchema,
  areaCreateSchema,
  areaUpdateSchema,
  idParamsSchema,
} from '../../schemas/master-data';

const areaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: areaListQuerySchema },
    listAreas,
  );
  fastify.get(
    '/:id',
    { preHandler: verifyTokenAndRole(ROLE_NAMES), schema: idParamsSchema },
    getArea,
  );
  fastify.post(
    '/',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: areaCreateSchema },
    createArea,
  );
  fastify.patch(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: areaUpdateSchema },
    updateArea,
  );
  fastify.delete(
    '/:id',
    { preHandler: verifyTokenAndRole(SYSTEM_MANAGER_ROLES), schema: idParamsSchema },
    deleteArea,
  );
};

export default areaRoutes;

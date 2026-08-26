import type { FastifyPluginAsync } from 'fastify';
import { listWorkShifts } from '../../../controllers/work-shifts';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';

const workShiftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [
        verifyToken,
        requirePermission(PERMISSION_CODE.ADMIN_USER_READ),
      ],
    },
    listWorkShifts,
  );
};

export default workShiftRoutes;

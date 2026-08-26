import type { FastifyPluginAsync } from 'fastify';
import {
  assignUserWorkShift,
  getUserWorkShiftAssignments,
} from '../../../controllers/work-shifts';
import { PERMISSION_CODE } from '../../../domain/permission-codes';
import { requirePermission, verifyToken } from '../../../middleware/auth';
import {
  assignUserWorkShiftSchema,
  userWorkShiftAssignmentListSchema,
} from '../../../schemas/work-shifts';

const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [
        verifyToken,
        requirePermission(PERMISSION_CODE.ADMIN_USER_READ),
      ],
      schema: userWorkShiftAssignmentListSchema,
    },
    getUserWorkShiftAssignments,
  );

  fastify.post(
    '/',
    {
      preHandler: [
        verifyToken,
        requirePermission(PERMISSION_CODE.ADMIN_USER_UPDATE),
      ],
      schema: assignUserWorkShiftSchema,
    },
    assignUserWorkShift,
  );
};

export default assignmentRoutes;

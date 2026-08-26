import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  AssignUserWorkShiftBody,
  UserWorkShiftAssignmentQuery,
} from '../../interfaces/work-shifts';
import { WorkShiftsService } from '../../services/work-shifts.service';
import { respondWithData } from '../master-data-response';

export const listWorkShifts = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new WorkShiftsService(request.server).listActive());

export const getUserWorkShiftAssignments = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(request, reply, () =>
  new WorkShiftsService(request.server).getAssignmentHistory(
    (request.query as UserWorkShiftAssignmentQuery).user_id,
  ));

export const assignUserWorkShift = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(request, reply, () =>
  new WorkShiftsService(request.server).assign(
    request.body as AssignUserWorkShiftBody,
    request.user.id,
  ), 201);

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MilkrunDashboardQuery } from '../../interfaces/milkrun-dashboard';
import { MilkrunDashboardService } from '../../services/milkrun-dashboard.service';
import { respondWithData } from '../master-data-response';

export const getMilkrunDashboard = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new MilkrunDashboardService(request.server).get(
    request.user.id,
    request.query as MilkrunDashboardQuery,
  ),
);


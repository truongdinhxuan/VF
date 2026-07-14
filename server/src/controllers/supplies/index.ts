import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupplyListQuery } from '../../interfaces/supplies';
import { MasterDataServiceError } from '../../services/master-data.helpers';
import { SuppliesService } from '../../services/supplies.service';
import { respondWithData } from '../master-data-response';

export const listSupplies = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => {
    if (!request.user) throw new MasterDataServiceError(401, 'Unauthorized');
    return new SuppliesService(request.server).list(
      request.user.role,
      request.query as SupplyListQuery,
    );
  });

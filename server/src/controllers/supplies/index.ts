import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreateSupplyBody,
  SupplyListQuery,
  SupplyProviderListQuery,
  UpdateSupplyBody,
} from '../../interfaces/supplies';
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

export const getSupply = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => {
    if (!request.user) throw new MasterDataServiceError(401, 'Unauthorized');
    return new SuppliesService(request.server).get(
      request.user.role,
      (request.params as { id: string }).id,
    );
  });

export const listSupplyProviders = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(request, reply, () =>
  new SuppliesService(request.server).listProviders(
    (request.params as { id: string }).id,
    request.query as SupplyProviderListQuery,
  ));

export const createSupply = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new SuppliesService(request.server).create(request.body as CreateSupplyBody),
    201,
  );

export const updateSupply = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SuppliesService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdateSupplyBody,
    ));

export const deleteSupply = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new SuppliesService(request.server).remove((request.params as { id: string }).id));

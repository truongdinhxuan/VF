import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  MilkrunMasterBody,
  MilkrunMasterListQuery,
  MilkrunMasterResource,
  MilkrunMasterUpdateBody,
} from '../../interfaces/milkrun-master-data';
import { MilkrunMasterDataService } from '../../services/milkrun-master-data.service';
import { respondWithData } from '../master-data-response';

const service = (request: FastifyRequest, resource: MilkrunMasterResource) =>
  new MilkrunMasterDataService(request.server, resource);

export const createMilkrunMasterHandlers = (
  resource: MilkrunMasterResource,
) => ({
  list: (request: FastifyRequest, reply: FastifyReply) => respondWithData(
    request,
    reply,
    () => service(request, resource).list(
      request.query as MilkrunMasterListQuery,
    ),
  ),
  get: (request: FastifyRequest, reply: FastifyReply) => respondWithData(
    request,
    reply,
    () => service(request, resource).get(
      (request.params as { id: string }).id,
    ),
  ),
  create: (request: FastifyRequest, reply: FastifyReply) => respondWithData(
    request,
    reply,
    () => service(request, resource).create(
      request.body as MilkrunMasterBody,
    ),
    201,
  ),
  update: (request: FastifyRequest, reply: FastifyReply) => respondWithData(
    request,
    reply,
    () => service(request, resource).update(
      (request.params as { id: string }).id,
      request.body as MilkrunMasterUpdateBody,
      request.user.id,
    ),
  ),
  deactivate: (request: FastifyRequest, reply: FastifyReply) => respondWithData(
    request,
    reply,
    () => service(request, resource).deactivate(
      (request.params as { id: string }).id,
    ),
  ),
});

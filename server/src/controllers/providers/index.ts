import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreateProviderBody,
  ProviderListQuery,
  UpdateProviderBody,
} from '../../interfaces/providers';
import { ProvidersService } from '../../services/providers.service';
import { respondWithData } from '../master-data-response';

export const listProviders = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new ProvidersService(request.server).list(
    request.query as ProviderListQuery,
  ),
);

export const getProvider = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new ProvidersService(request.server).get(
    (request.params as { id: string }).id,
  ),
);

export const createProvider = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new ProvidersService(request.server).create(
    request.body as CreateProviderBody,
  ),
  201,
);

export const updateProvider = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new ProvidersService(request.server).update(
    (request.params as { id: string }).id,
    request.body as UpdateProviderBody,
  ),
);

export const deactivateProvider = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(
  request,
  reply,
  () => new ProvidersService(request.server).deactivate(
    (request.params as { id: string }).id,
  ),
);

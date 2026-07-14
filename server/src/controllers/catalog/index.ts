import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  StorageLocationListQuery,
  SupplyListQuery,
} from '../../interfaces/catalog';
import {
  CatalogService,
  CatalogServiceError,
} from '../../services/catalog.service';

const respond = async (
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<unknown>,
) => {
  try {
    return reply.code(200).send({ data: await handler() });
  } catch (error) {
    if (error instanceof CatalogServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const listSupplies = (request: FastifyRequest, reply: FastifyReply) =>
  respond(request, reply, () => {
    if (!request.user) throw new CatalogServiceError(401, 'Unauthorized');
    return new CatalogService(request.server).listSupplies(
      request.user.role,
      request.query as SupplyListQuery,
    );
  });

export const listAreas = (request: FastifyRequest, reply: FastifyReply) =>
  respond(request, reply, () => new CatalogService(request.server).listAreas());

export const listStorageLocations = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respond(request, reply, () =>
  new CatalogService(request.server).listStorageLocations(
    request.query as StorageLocationListQuery,
  ));

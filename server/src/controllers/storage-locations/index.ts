import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreateStorageLocationBody,
  StorageLocationListQuery,
  UpdateStorageLocationBody,
} from '../../interfaces/storage-locations';
import { StorageLocationsService } from '../../services/storage-locations.service';
import { respondWithData } from '../master-data-response';

export const listStorageLocations = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(request, reply, () =>
  new StorageLocationsService(request.server).list(
    request.query as StorageLocationListQuery,
  ));

export const getStorageLocation = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new StorageLocationsService(request.server).get(
      (request.params as { id: string }).id,
    ));

export const createStorageLocation = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new StorageLocationsService(request.server).create(
      request.body as CreateStorageLocationBody,
    ),
    201,
  );

export const updateStorageLocation = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new StorageLocationsService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdateStorageLocationBody,
    ));

export const deleteStorageLocation = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new StorageLocationsService(request.server).remove(
      (request.params as { id: string }).id,
    ));

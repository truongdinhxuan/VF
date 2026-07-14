import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StorageLocationListQuery } from '../../interfaces/storage-locations';
import { StorageLocationsService } from '../../services/storage-locations.service';
import { respondWithData } from '../master-data-response';

export const listStorageLocations = (
  request: FastifyRequest,
  reply: FastifyReply,
) => respondWithData(request, reply, () =>
  new StorageLocationsService(request.server).list(
    request.query as StorageLocationListQuery,
  ));

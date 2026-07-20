import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  ActiveListQuery,
  CreateUnitBody,
  UpdateUnitBody,
} from '../../interfaces/master-data';
import { UnitsService } from '../../services/units.service';
import { respondWithData } from '../master-data-response';

export const listUnits = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new UnitsService(request.server).list(request.query as ActiveListQuery));

export const getUnit = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new UnitsService(request.server).get((request.params as { id: string }).id));

export const createUnit = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new UnitsService(request.server).create(request.body as CreateUnitBody),
    201,
  );

export const updateUnit = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new UnitsService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdateUnitBody,
    ));

export const deleteUnit = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new UnitsService(request.server).remove((request.params as { id: string }).id));

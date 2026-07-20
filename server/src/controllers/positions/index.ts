import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CreatePositionBody,
  SearchListQuery,
  UpdatePositionBody,
} from '../../interfaces/master-data';
import { PositionsService } from '../../services/positions.service';
import { respondWithData } from '../master-data-response';

export const listPositions = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new PositionsService(request.server).list(request.query as SearchListQuery));

export const getPosition = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new PositionsService(request.server).get((request.params as { id: string }).id));

export const createPosition = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new PositionsService(request.server).create(request.body as CreatePositionBody),
    201,
  );

export const updatePosition = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new PositionsService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdatePositionBody,
    ));

export const deletePosition = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new PositionsService(request.server).remove((request.params as { id: string }).id));

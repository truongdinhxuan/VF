import type { FastifyReply, FastifyRequest } from 'fastify';
import { AreasService } from '../../services/areas.service';
import { respondWithData } from '../master-data-response';

export const listAreas = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => new AreasService(request.server).list());

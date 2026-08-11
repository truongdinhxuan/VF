import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CancelMilkrunTripBody,
  CreateMilkrunTripBody,
  MilkrunTripActor,
  MilkrunTripListQuery,
} from '../../interfaces/milkrun-trips';
import { MilkrunTripService } from '../../services/milkrun-trips.service';
import { respondWithData } from '../master-data-response';

const actorFrom = (request: FastifyRequest): MilkrunTripActor => ({
  id: request.user.id,
  permissions: request.user.permissions,
  isSystemAdmin: request.user.isSystemAdmin,
});

const service = (request: FastifyRequest) => new MilkrunTripService(request.server);
const idFrom = (request: FastifyRequest) => (request.params as { id: string }).id;

export const listMilkrunTrips = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).list(
    actorFrom(request),
    request.query as MilkrunTripListQuery,
  ));

export const getMilkrunTrip = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).get(actorFrom(request), idFrom(request)));

export const createMilkrunTrip = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).create(
    actorFrom(request),
    request.body as CreateMilkrunTripBody,
  ), 201);

export const startMilkrunTrip = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).start(actorFrom(request), idFrom(request)));

export const arriveMilkrunTrip = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).arrive(actorFrom(request), idFrom(request)));

export const cancelMilkrunTrip = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () => service(request).cancel(
    actorFrom(request),
    idFrom(request),
    (request.body ?? {}) as CancelMilkrunTripBody,
  ));


import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RoleListQuery } from '../../interfaces/master-data';
import type { CreateRoleBody, UpdateRoleBody } from '../../interfaces/master-data';
import { RolesService } from '../../services/roles.service';
import { respondWithData } from '../master-data-response';

export const listRoles = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new RolesService(request.server).list(request.query as RoleListQuery));

export const getRole = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new RolesService(request.server).get((request.params as { id: string }).id));

export const createRole = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(
    request,
    reply,
    () => new RolesService(request.server).create(request.body as CreateRoleBody),
    201,
  );

export const updateRole = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new RolesService(request.server).update(
      (request.params as { id: string }).id,
      request.body as UpdateRoleBody,
    ));

export const deleteRole = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithData(request, reply, () =>
    new RolesService(request.server).remove((request.params as { id: string }).id));

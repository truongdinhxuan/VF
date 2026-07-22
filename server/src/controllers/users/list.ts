import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserListQuery } from '../../interfaces/users';
import { UsersService } from '../../services/users.service';
import { toPaginatedResponse } from '../../utils/pagination';
import { respondWithUserData } from './response';

export const userIndex = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithUserData(request, reply, async () => {
    const result = await new UsersService(request.server).list(
      request.query as UserListQuery,
    );
    return toPaginatedResponse(result);
  });

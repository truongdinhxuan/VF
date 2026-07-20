import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsersService } from '../../services/users.service';
import { respondWithUserData } from './response';

export const getUserById = (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  return respondWithUserData(request, reply, async () => ({
    message: `Lấy người dùng ${id} thành công`,
    data: await new UsersService(request.server).get(id),
  }));
};

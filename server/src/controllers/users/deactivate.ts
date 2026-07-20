import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsersService } from '../../services/users.service';
import { respondWithUserData } from './response';

export const deactivateUser = (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  return respondWithUserData(request, reply, async () => ({
    message: 'Đã vô hiệu hóa người dùng',
    data: await new UsersService(request.server).deactivate(id),
  }));
};

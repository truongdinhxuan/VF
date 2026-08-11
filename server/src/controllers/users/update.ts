import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UpdateUserBody } from '../../interfaces/users';
import { UsersService } from '../../services/users.service';
import { respondWithUserData } from './response';

export const userUpdate = (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  return respondWithUserData(request, reply, async () => ({
    message: 'Cập nhật người dùng thành công',
    data: await new UsersService(request.server).update(
      id,
      request.body as UpdateUserBody,
      request.user.id,
    ),
  }));
};

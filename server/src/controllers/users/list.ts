import type { FastifyReply, FastifyRequest } from 'fastify';
import { UsersService } from '../../services/users.service';
import { respondWithUserData } from './response';

export const userIndex = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithUserData(request, reply, async () => {
    const result = await new UsersService(request.server).list();
    return {
      message: 'Lấy danh sách người dùng thành công',
      total: result.total,
      users: result.users,
    };
  });

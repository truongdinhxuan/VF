import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateUserBody } from '../../interfaces/users';
import { UsersService } from '../../services/users.service';
import { respondWithUserData } from './response';

export const createUser = (request: FastifyRequest, reply: FastifyReply) =>
  respondWithUserData(
    request,
    reply,
    async () => ({
      message: 'Tạo người dùng thành công. Tài khoản đang chờ duyệt.',
      data: await new UsersService(request.server).create(
        request.body as CreateUserBody,
      ),
    }),
    201,
  );

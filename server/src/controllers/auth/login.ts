import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginBody } from '../../interfaces/users';
import {
  getUserProfileById,
  UsersService,
  UsersServiceError,
} from '../../services/users.service';

export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { vinfast_id, password } = request.body as LoginBody;

  if (!Number.isInteger(vinfast_id) || !password) {
    return reply.code(400).send({
      error: 'VinFast ID và mật khẩu là bắt buộc',
    });
  }

  try {
    const publicData = await new UsersService(request.server).authenticate(
      vinfast_id,
      password,
    );
    const token = await reply.jwtSign({ sub: publicData.id });

    return reply.code(200).send({
      message: 'Đăng nhập thành công',
      token,
      publicData,
    });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        ...(error.message.includes('chờ duyệt')
          ? { code: 'ACCOUNT_NOT_VERIFIED' }
          : {}),
      });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;

  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const publicData = await getUserProfileById(request.server, userId);

    if (!publicData) {
      return reply.code(404).send({ error: 'Không tìm thấy hồ sơ người dùng' });
    }

    return reply.code(200).send({
      id: userId,
      email: request.user?.email,
      publicData,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};

import type { FastifyReply, FastifyRequest } from 'fastify';
import { ROLE_CODE } from '../../domain/enums';
import {
  UsersService,
  UsersServiceError,
} from '../../services/users.service';

interface UpdatePasswordBody {
  currentPassword?: string;
  newPassword: string;
  confirmNewPassword: string;
}

export const userUpdatePassword = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const { id } = request.params as { id: string };

    const isSelf = request.user.id === id;
    const isAdmin = request.user.role === ROLE_CODE.ADMIN;
    if (!isSelf && !isAdmin) {
      return reply.code(403).send({
        error: 'Bạn không có quyền đặt mật khẩu cho người dùng này',
      });
    }

    const { currentPassword, newPassword, confirmNewPassword } =
      request.body as UpdatePasswordBody;

    if (newPassword !== confirmNewPassword) {
      return reply.code(400).send({
        error: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
      });
    }

    const service = new UsersService(request.server);
    if (isSelf) {
      if (!currentPassword) {
        return reply.code(400).send({
          error: 'Mật khẩu hiện tại là bắt buộc',
        });
      }
      await service.updatePassword(id, currentPassword, newPassword);
    } else {
      await service.setPassword(id, newPassword);
    }

    return reply.code(200).send({
      message: isSelf
        ? 'Cập nhật mật khẩu thành công'
        : 'ADMIN đã đặt mật khẩu người dùng thành công',
    });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginBody } from '../../interfaces/users';
import { getUserProfileById } from '../../services/users.service';

export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as LoginBody;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email và mật khẩu là bắt buộc' });
  }

  try {
    const { data: authData, error: authError } =
      await request.server.supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return reply.code(401).send({ error: 'Sai email hoặc mật khẩu' });
    }

    const publicData = await getUserProfileById(request.server, authData.user.id);

    if (!publicData || !publicData.is_active || publicData.is_deleted) {
      return reply.code(403).send({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    if (!publicData.is_verified) {
      return reply.code(403).send({
        error: 'Tài khoản đang chờ duyệt và chưa được phép truy cập dữ liệu nội bộ',
        code: 'ACCOUNT_NOT_VERIFIED',
      });
    }

    return reply.code(200).send({
      message: 'Đăng nhập thành công',
      token: authData.session?.access_token,
      publicData,
    });
  } catch (error) {
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

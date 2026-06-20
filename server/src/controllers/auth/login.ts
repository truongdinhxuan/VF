import { FastifyRequest, FastifyReply } from 'fastify';
import { UserInterface } from '../../interfaces/users';
import { getUserProfileById } from '../../services/user.service'; // Import hàm vừa tạo

/**
 * 1. Controller Đăng nhập
 */
export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as UserInterface;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Please enter field.' });
  }

  try {
    const { data: authData, error: authError } = await request.server.supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError || !authData.user) {
      return reply.code(401).send({ error: 'Wrong email or password' });
    }

    // TÁI SỬ DỤNG HÀM: Lấy public data
    const publicData = await getUserProfileById(request.server, authData.user.id);

    return reply.code(200).send({
      message: 'Đăng nhập thành công!',
      token: authData.session?.access_token,
      publicData: publicData, 
    });

  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Server failed' });
  }
};

/**
 * 2. Controller lấy thông tin hiện tại (GET /auth/me)
 */
export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  // Nhờ middleware verifyTokenAndRole, ta có ID của user từ token
  const userId = request.user?.id;

  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    // TÁI SỬ DỤNG LẠI CHÍNH HÀM ĐÓ
    const publicData = await getUserProfileById(request.server, userId);

    if (!publicData) {
      return reply.code(404).send({ error: 'Không tìm thấy hồ sơ người dùng' });
    }

    return reply.code(200).send({
      id: userId,
      email: request.user?.email,
      publicData: publicData // Trả về y hệt cấu trúc lúc login
    });

  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Server failed' });
  }
};
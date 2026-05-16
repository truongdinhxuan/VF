import { FastifyRequest, FastifyReply } from 'fastify';
import { UserInterface } from '../../interfaces/users';
/**
 * Controller cho chức năng Đăng nhập (Login)
 */
export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as UserInterface;
  console.log({email, password})
  if (!email || !password) {
    return reply.code(400).send({ error: 'Please enter field.' });
  }

  try {
    // Gọi hàm đăng nhập của Supabase
    const { data, error } = await request.server.supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    // Sai email hoặc mật khẩu
    if (error) {
      return reply.code(401).send({ error: 'Wrong email or password' });
    }

    // Đăng nhập thành công, trả về Access Token cho Client lưu trữ (ở LocalStorage hoặc Cookie)
    return reply.code(200).send({
      message: 'Đăng nhập thành công!',
      token: data.session?.access_token,
      user: data.user
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Server failed' });
  }
};
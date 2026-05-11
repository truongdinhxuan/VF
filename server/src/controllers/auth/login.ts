import { FastifyRequest, FastifyReply } from 'fastify';

// Định nghĩa kiểu dữ liệu (Interface) cho dữ liệu gửi lên từ Client
interface AuthBody {
  email?: string;
  password?: string;
  fullName?: string;
}

/**
 * Controller cho chức năng Đăng ký (Register / Signup)
 */
export const registerUser = async (request: FastifyRequest, reply: FastifyReply) => {
  // Lấy dữ liệu từ body và ép kiểu sang AuthBody
  const { email, password, fullName } = request.body as AuthBody;

  // Kiểm tra dữ liệu đầu vào cơ bản
  if (!email || !password) {
    return reply.code(400).send({ error: 'Vui lòng nhập đầy đủ email và password' });
  }

  try {
    // Gọi Supabase Auth thông qua plugin đã setup ở request.server.supabase
    const { data, error } = await request.server.supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName } // Lưu thêm tên người dùng vào metadata của Supabase
      }
    });

    // Nếu Supabase trả về lỗi (VD: email đã tồn tại, pass quá ngắn)
    if (error) {
      return reply.code(400).send({ error: error.message });
    }

    // Đăng ký thành công
    return reply.code(201).send({
      message: 'Đăng ký tài khoản thành công! (Vui lòng kiểm tra email để xác thực nếu Supabase yêu cầu).',
      data: data.user
    });
  } catch (err) {
    // Bắt lỗi server bất ngờ
    request.log.error(err);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * Controller cho chức năng Đăng nhập (Login)
 */
export const loginUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as AuthBody;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Vui lòng nhập email và password' });
  }

  try {
    // Gọi hàm đăng nhập của Supabase
    const { data, error } = await request.server.supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    // Sai email hoặc mật khẩu
    if (error) {
      return reply.code(401).send({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Đăng nhập thành công, trả về Access Token cho Client lưu trữ (ở LocalStorage hoặc Cookie)
    return reply.code(200).send({
      message: 'Đăng nhập thành công!',
      token: data.session?.access_token,
      user: data.user
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};
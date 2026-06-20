import { FastifyRequest, FastifyReply } from 'fastify';

// 1. Mở rộng Type của FastifyRequest để TypeScript không báo lỗi khi ta gán thêm biến request.user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      role: string;
    };
  }
}

/**
 * Middleware xác thực Token và Phân quyền Role
 * @param allowedRoles Mảng chứa các role được phép truy cập (VD: ['admin', 'manager']). Để mảng rỗng [] nếu chỉ cần đăng nhập.
 */
export const verifyTokenAndRole = (allowedRoles: string[] = []) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') {
      return; 
    }
    try {
      // 1. Lấy token từ header (Định dạng chuẩn: Bearer <token>)
      const authHeader = request.headers.authorization;
      console.log("References: ",authHeader)
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Vui lòng cung cấp Token hợp lệ' });
      }

      const token = authHeader.replace('Bearer ', '');

      // 2. Nhờ Supabase xác thực Token xem có bị fake hay hết hạn không
      const { data: authData, error: authError } = await request.server.supabase.auth.getUser(token);

      if (authError || !authData.user) {
        return reply.code(401).send({ error: 'Token đã hết hạn hoặc không hợp lệ' });
      }

      // 3. Lấy Role của user từ bảng public.users bằng supabaseAdmin
      const { data: publicData, error: publicError } = await request.server.supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (publicError || !publicData) {
        return reply.code(403).send({ error: 'Không tìm thấy hồ sơ người dùng' });
      }

      const userRole = publicData.role;

      // 4. Kiểm tra quyền (Role)
      // Nếu mảng allowedRoles có phần tử VÀ role của user KHÔNG nằm trong mảng đó -> Chặn!
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        request.log.warn(`User ${authData.user.id} cố gắng truy cập API trái phép.`);
        return reply.code(403).send({ error: 'Bạn không có quyền truy cập chức năng này' });
      }

      // 5. Mọi thứ hợp lệ -> Gắn cục data vào request để các Controller sau này dùng trực tiếp luôn
      request.user = {
        id: authData.user.id,
        email: authData.user.email,
        role: userRole
      };

      // Xong nhiệm vụ middleware, Fastify sẽ tự động chạy tiếp vào Controller
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Lỗi máy chủ trong quá trình xác thực' });
    }
  };
};
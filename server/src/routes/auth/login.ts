import { FastifyPluginAsync } from 'fastify';
import { loginUser } from '../../controllers/auth/login'
// import { verifyTokenHook } from '../../plugins/auth.middleware';

/**
 * Khai báo một Fastify Plugin chứa các Routes.
 * Nếu file này nằm ở `src/routes/auth/index.ts`, 
 * fastify-autoload sẽ tự tạo đường dẫn gốc là: `/auth`
 */
const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // 2. Route Đăng nhập: POST /auth/login
  fastify.post('/login', loginUser);

  // --------------------------------------------------------
  // MIDDLEWARE (HOOK) TRONG FASTIFY
  // --------------------------------------------------------
  
  // 3. Route lấy thông tin cá nhân: GET /auth/profile
  // Route này cần bảo mật, chỉ ai đăng nhập mới được xem.
  // Chúng ta gắn hook `verifyTokenHook` vào mục `preHandler`.
  fastify.get('/profile', {
    // preHandler: [verifyTokenHook] // Chạy middleware này trước!
  }, async (request, reply) => {
    // Nếu đoạn code này chạy, nghĩa là verifyTokenHook đã vượt qua thành công
    return reply.send({
      message: 'Đây là thông tin mật của User',
      user: { name: 'Admin', role: 'Super Admin' }
    });
  });

};

export default authRoutes;
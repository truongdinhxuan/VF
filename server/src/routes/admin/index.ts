import { FastifyPluginAsync } from 'fastify';
import { userIndex } from '../../controllers/admin/users';
// import { verifyTokenHook } from '../../plugins/auth.middleware'; // Sau này bạn nên gắn middleware kiểm tra quyền Admin vào đây

const adminRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Route: GET /admin/users
  fastify.get('/users', userIndex);

};

export default adminRoutes;
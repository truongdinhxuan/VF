import { FastifyPluginAsync } from 'fastify';
import { userIndex } from '../../controllers/admin/users/userIndex';
import { getUserById } from '../../controllers/admin/users/userDetail';
import { verifyTokenAndRole } from '../../middleware/auth';
import { adminIndex } from '../../controllers/admin';
// import { verifyTokenHook } from '../../plugins/auth.middleware'; // Sau này bạn nên gắn middleware kiểm tra quyền Admin vào đây

const adminRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Route: GET /admin/users
  fastify.addHook('preHandler',verifyTokenAndRole(['admin']))
  fastify.get('/',adminIndex)
  fastify.get('/users', userIndex);
  fastify.get('/users/:id',getUserById)
};

export default adminRoutes;
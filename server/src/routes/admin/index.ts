import { FastifyPluginAsync } from 'fastify';
import { userIndex } from '../../controllers/admin/users/userIndex';
import { getUserById } from '../../controllers/admin/users/userDetail';
// import { verifyTokenAndRole } from '../../middleware/auth';
import { adminIndex } from '../../controllers/admin';
import { createUser } from '../../controllers/admin/users/userCreate';
import { userUpdate } from '../../controllers/admin/users/userUpdate';
import { userUpdatePassword } from '../../controllers/admin/users/userUpdatePassword';
// import { verifyTokenHook } from '../../plugins/auth.middleware'; // Sau này bạn nên gắn middleware kiểm tra quyền Admin vào đây

const adminRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // Route: GET /admin/users
  // fastify.addHook('preHandler',verifyTokenAndRole(['admin']))
  fastify.get('/',adminIndex)

  /*
      Admin User side
  */

  fastify.get('/users', userIndex);
  fastify.get('/users/:id',getUserById)
  fastify.post('/users', createUser);
  fastify.put('/users/:id', userUpdate);
  fastify.patch('/users/:id/password', userUpdatePassword);
};

export default adminRoutes;
import type { FastifyPluginAsync } from 'fastify';
import { createUser } from '../../controllers/users/create';
import { getUserById } from '../../controllers/users/detail';
import { userIndex } from '../../controllers/users/list';
import { userUpdate } from '../../controllers/users/update';
import { userUpdatePassword } from '../../controllers/users/update-password';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', userIndex);
  fastify.get('/:id', getUserById);
  fastify.post('/', createUser);
  fastify.put('/:id', userUpdate);
  fastify.patch('/:id/password', userUpdatePassword);
};

export default userRoutes;

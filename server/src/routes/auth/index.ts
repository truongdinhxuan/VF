import { FastifyPluginAsync } from 'fastify';
import { loginUser } from '../../controllers/auth/login'
import { registerUser } from '../../controllers/auth/register'

export const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/login', loginUser)
  fastify.post('/register', registerUser)
}
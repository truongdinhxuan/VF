import { FastifyPluginAsync } from 'fastify';
import { registerUser } from '../../controllers/auth/register'

const registerRoutes: FastifyPluginAsync = async(fastify, opts) : Promise<void> => {
  
  // 1. Route Đăng ký: POST /auth/register
  fastify.post('/register', registerUser)
}
export default registerRoutes
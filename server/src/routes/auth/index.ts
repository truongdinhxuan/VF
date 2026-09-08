import { FastifyPluginAsync } from "fastify";
import {
  getMe,
  loginUser,
  logoutUser,
  refreshSession,
} from "../../controllers/auth/login";
import { verifyToken } from '../../middleware/auth';
import {
  loginSchema,
  logoutSchema,
  refreshSessionSchema,
} from "../../schemas/users";
import { requireTrustedAuthOrigin } from '../../services/auth-sessions.service';

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post("/login", {
    schema: loginSchema,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, loginUser);
  fastify.post('/refresh', {
    schema: refreshSessionSchema,
    preHandler: [requireTrustedAuthOrigin],
  }, refreshSession);
  fastify.post('/logout', {
    schema: logoutSchema,
    preHandler: [requireTrustedAuthOrigin],
  }, logoutUser);
  fastify.get("/me",{
    preHandler: [verifyToken]
  }, getMe)
};
export default authRoutes;

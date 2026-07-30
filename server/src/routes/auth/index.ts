import { FastifyPluginAsync } from "fastify";
import { getMe, loginUser } from "../../controllers/auth/login";
import { verifyTokenAndRole } from "../../middleware/auth";
import { loginSchema } from "../../schemas/users";

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post("/login", { schema: loginSchema }, loginUser);
  fastify.get("/me",{
    preHandler: [verifyTokenAndRole([])]
  }, getMe)
};
export default authRoutes;

import { FastifyPluginAsync } from "fastify";
import { getMe, loginUser } from "../../controllers/auth/login";
import { registerUser } from "../../controllers/auth/register";
import { verifyTokenAndRole } from "../../middleware/auth";

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post("/login", loginUser);
  fastify.post("/register", registerUser);
  fastify.get("/me",{
    preHandler: [verifyTokenAndRole([])]
  }, getMe)
};
export default authRoutes;

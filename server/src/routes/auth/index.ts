import { FastifyPluginAsync } from "fastify";
import { getMe, loginUser } from "../../controllers/auth/login";
import { verifyTokenAndRole } from "../../middleware/auth";

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post("/login", loginUser);
  fastify.get("/me",{
    preHandler: [verifyTokenAndRole([])]
  }, getMe)
};
export default authRoutes;

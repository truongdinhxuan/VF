import fp from "fastify-plugin";
import cors from "@fastify/cors";

/**
 * Plugin cấu hình CORS (Cross-Origin Resource Sharing)
 * Cho phép Frontend ở port khác gọi được API của Backend
 */
export default fp(async (fastify, opts) => {
  await fastify.register(cors, {
    origin: process.env.ORIGIN_URL,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  // console.log(process.env.ORIGIN_URL);
  fastify.log.info("Cors is actived on http://localhost:5173");
});

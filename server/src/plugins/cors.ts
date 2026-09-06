import fp from "fastify-plugin";
import cors from "@fastify/cors";

/**
 * Plugin cấu hình CORS (Cross-Origin Resource Sharing)
 * Cho phép Frontend ở port khác gọi được API của Backend
 */
export default fp(async (fastify, opts) => {
  const origin = process.env.ORIGIN_URL;

  await fastify.register(cors, {
    origin,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ['Content-Disposition'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  fastify.log.info({ origin }, "CORS is active for the configured frontend origin");
});

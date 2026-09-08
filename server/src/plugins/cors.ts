import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { getAllowedClientOrigins } from '../config/auth';

/**
 * Plugin cấu hình CORS (Cross-Origin Resource Sharing)
 * Cho phép Frontend ở port khác gọi được API của Backend
 */
export default fp(async (fastify, opts) => {
  const allowedOrigins = getAllowedClientOrigins();

  await fastify.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ['Content-Disposition'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  fastify.log.info(
    { allowedOrigins },
    "CORS is active for the configured frontend origins",
  );
});

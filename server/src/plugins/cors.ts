import fp from "fastify-plugin";
import cors from "@fastify/cors";

/**
 * Plugin cấu hình CORS (Cross-Origin Resource Sharing)
 * Cho phép Frontend ở port khác gọi được API của Backend
 */
export default fp(async (fastify, opts) => {
  await fastify.register(cors, {
    // Chỉ định Frontend nào được phép gọi API.
    // Bạn đang dùng Vite nên Frontend thường ở port 5173
    // origin: process.env.ORIGIN_URL,
    origin: "http://localhost:5173",
    // origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  console.log(process.env.ORIGIN_URL);
  fastify.log.info("✅ CORS đã được bật cho http://localhost:5173");
});

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export default fp(async (fastify, opts) => {
  const publicApiUrl = process.env.API_PUBLIC_URL?.trim();
  // 1. Đăng ký core Swagger để tạo cấu trúc OpenAPI
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Milkrun & Rack API',
        description: 'API document system for Milkrun app',
        version: '1.0.0'
      },
      ...(publicApiUrl ? {
        servers: [{ url: publicApiUrl, description: 'Configured API server' }],
      } : {}),
      components: {
        // Cấu hình nút "Authorize" để nhập Token (cho các API cần đăng nhập)
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });

  // 2. Đăng ký giao diện UI hiển thị web
  await fastify.register(swaggerUi, {
    routePrefix: '/docs', // Đây sẽ là đường dẫn bạn gõ trên trình duyệt
    uiConfig: {
      docExpansion: 'list', // Hiển thị list các API, không mở tung ra hết cho gọn
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
  
  fastify.log.info('Swagger is ready on /docs');
});

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  await fastify.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Quá nhiều lần thử. Vui lòng thử lại sau ${context.after}.`,
    }),
  });
});


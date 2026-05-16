import fp from 'fastify-plugin';
import { FastifyError } from 'fastify';
export default fp(async (fastify, opts) => {
  
  // 1. Cấu hình bắt mọi lỗi (Exceptions/Errors) xảy ra trong hệ thống
  fastify.setErrorHandler(function (error: FastifyError, request, reply) {
    // In lỗi ra màn hình Terminal (Kèm theo ID của request để dễ tra cứu)
    request.log.error(error);

    // Xác định mã lỗi (Mặc định là 500 nếu code tự crash)
    const statusCode = error.statusCode || 500;
    
    // Kiểm tra xem có phải đang code ở máy cá nhân không
    const isDev = process.env.NODE_ENV !== 'production';

    // Trả về cho Frontend dạng JSON đẹp đẽ
    reply.status(statusCode).send({
      statusCode: statusCode,
      error: error.name || 'Internal Server Error',
      // Nếu là lỗi 500 trên server thật thì giấu message đi cho bảo mật, còn đang dev thì hiện hết
      message: (statusCode === 500 && !isDev) ? 'Something messing in server side' : error.message,
      // Hiển thị Stack Trace (Chỉ ra chính xác file/dòng code nào bị lỗi) khi đang Dev
      stack: isDev ? error.stack : undefined
    });
  });

  // 2. (Khuyến nghị thêm) Cấu hình bắt lỗi 404 Not Found tùy chỉnh
  fastify.setNotFoundHandler(function (request, reply) {
    request.log.warn(`Invalid API address: ${request.method} ${request.url}`);
    
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Address ${request.url} is invalid in system.`
    });
  });

  fastify.log.info('Global Error Handler is actived!');
});
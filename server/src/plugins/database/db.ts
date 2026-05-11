import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

/**
 * Plugin khởi tạo kết nối Supabase
 */
export default fp(async (fastify, opts) => {
  // Lấy dữ liệu từ process.env (đã được load tự động bởi hệ thống trước khi chạy file này)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  // Kiểm tra xem đã lấy được key chưa. Nếu chưa thì ném lỗi ra terminal luôn
  if (!supabaseUrl || !supabaseKey) {
    fastify.log.error('❌ KHÔNG TÌM THẤY SUPABASE_URL hoặc SUPABASE_ANON_KEY. Hãy kiểm tra lại file .env!');
    throw new Error('Missing Supabase credentials');
  }

  // Khởi tạo client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Gắn (decorate) biến supabase vào Fastify
  fastify.decorate('supabase', supabase);
  
  fastify.log.info('✅ Đã kết nối thành công tới Supabase!');
});
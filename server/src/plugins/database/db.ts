import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;       // Dùng cho User thường (Login, Register)
    supabaseAdmin: SupabaseClient;  // Dùng cho Admin (Bỏ qua mọi rule bảo mật)
  }
}

export default fp(async (fastify, opts) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
    fastify.log.error('❌ Thiếu biến môi trường Supabase!');
    throw new Error('Missing Supabase credentials');
  }

  // 1. Client thường (Cho user)
  const supabase = createClient(supabaseUrl, supabaseKey);
  fastify.decorate('supabase', supabase);

  // 2. Client Admin (Cho các tác vụ đặc quyền)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  fastify.decorate('supabaseAdmin', supabaseAdmin);
  
  fastify.log.info('✅ Đã kết nối Supabase (Client & Admin)!');
});
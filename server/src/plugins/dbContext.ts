import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient;
  }
}

export default fp(async (fastify, opts) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    fastify.log.error('Missing enviroment Supabase!');
    throw new Error('Missing Supabase credentials');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  fastify.decorate('supabaseAdmin', supabaseAdmin);
  
  fastify.log.info('Connected successfully to database!');
});

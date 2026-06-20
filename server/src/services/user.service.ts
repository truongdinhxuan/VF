import { FastifyInstance } from 'fastify';

/**
 * Hàm dùng chung: Lấy thông tin public profile của user
 */
export const getUserProfileById = async (fastify: FastifyInstance, userId: string) => {
  const { data, error } = await fastify.supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    fastify.log.warn(`Không lấy được dữ liệu cho user ${userId}: ${error.message}`);
    return null; // Trả về null nếu có lỗi hoặc không tìm thấy
  }
  
  return data;
};
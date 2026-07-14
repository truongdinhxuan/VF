import { FastifyReply, FastifyRequest } from 'fastify'
/*
  Lấy all danh sách người dùng
  (Lần cập nhật tiếp theo sẽ limit 1 page get top 15 người dùng <phân trang>)
*/
export const userIndex = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    // SỬ DỤNG supabaseAdmin THAY VÌ supabase THƯỜNG
    // Hàm auth.admin.listUsers() chỉ hoạt động với Service Role Key
    const { data, error } = await request.server.supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .range(0, 10)
      .order('created_at', { ascending: false })

    if (error) {
      request.log.error(error);
      return reply.code(400).send({
        error: 'Không thể lấy danh sách người dùng',
        details: error.message
      });
    }
    console.log(data);
    // Trả về danh sách user
    return reply.code(200).send({
      message: 'Lấy danh sách người dùng thành công!',
      total: data.length,
      users: data
    });

  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
}

import { FastifyReply, FastifyRequest} from 'fastify'
/*
  Lấy id người dùng
  (Lần cập nhật tiếp theo sẽ limit 1 page get top 15 người dùng <phân trang>)
*/
interface GetUserParams {
  id: string
}
export const getUserById = async ( request: FastifyRequest,reply: FastifyReply): Promise<void> => {
  
    // SỬ DỤNG supabaseAdmin THAY VÌ supabase THƯỜNG
    // Hàm auth.admin.listUsers() chỉ hoạt động với Service Role Key
    const {id} = request.params as GetUserParams
    try {
      // lấy bản ghi duy nhất từ table user (áp dụng cho các model khác)
      const {data,error} = await request.server.supabaseAdmin
      .from('users')
      .select('*')
      .eq('id',id)
      .single()
      // single = trả về obj thay vì 1 mảng
      // Lấy bản ghi duy nhất từ authenticator table (áp dụng cho các cách login)
      // const {data , error} = await request.server.supabaseAdmin.auth.admin.getUserById(id)
      if (error) {
        console.log("Error có nội dung: ", error)
        // PGRST116 = single() nhưng ko tìm thấy data
        if(error.code==='PGRST116') {return reply.code(404).send({error: `Cannot found this ${id} in system`})}
        throw error
      }
      // if succesfull
      return reply.code(200).send({
        message: `Get user with ID ${id} successfully`,
        data: data
      })
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({error: `Server is getting trouble`})
    }
  }

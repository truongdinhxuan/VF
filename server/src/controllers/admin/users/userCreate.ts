import { FastifyReply, FastifyRequest } from "fastify"
import {type UserInterface} from '../../../interfaces/users'
  
  export const createUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as UserInterface
    if (!body.email || !body.password) {
      return reply.code(400).send({ error: 'Email và password là bắt buộc' })
    }
  
    // Step 1: Create auth user
    const { data: authData, error: authError } =
      await request.server.supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true, // admin-created users skip email verify
      })
  
    if (authError) {
      return reply.code(400).send({ error: authError.message })
    }
  
    const userId = authData.user.id
  
    // Step 2: Insert public profile
    const { data: publicData, error: publicError } =
      await request.server.supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: body.email,
          first_name: body.first_name,
          middle_name: body.middle_name ?? '',
          last_name: body.last_name,
          vinfast_id: body.vinfast_id,
          phone_number: body.phone_number ?? '',
          role: body.role,
          position: body.position ?? 0,
          managed_by: body.managed_by ?? 0,
          avatar_url: body.avatar_url ?? '',
          // tạm thời để verified = false, khi nào = true thì cần phê duyệt từ admin mới được
          isverified: false,
          isdeleted: false,
          // tạm thời quên chưa cho attribute updated_at
          created_at: new Date(),
          updated_at: new Date() ?? '',
        })
        .select()
        .single()
  
    if (publicError) {
      // Rollback auth user if profile insert fails
      await request.server.supabaseAdmin.auth.admin.deleteUser(userId)
      return reply.code(400).send({ error: publicError.message })
    }
  
    return reply.code(201).send({
      message: 'Tạo người dùng thành công',
      data: { id: userId, email: body.email, publicData },
    })
  }
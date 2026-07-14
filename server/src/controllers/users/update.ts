import { FastifyReply, FastifyRequest } from 'fastify';
import {type UserInterface} from '../../interfaces/users'

const PROFILE_FIELDS: (keyof UserInterface)[] = [
  'email',
  'first_name',
  'middle_name',
  'last_name',
  'vinfast_id',
  'avatar_url',
  'phone_number',
  'position',
  'managed_by',
  'role',
];

export const userUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as UserInterface;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    };

    for (const field of PROFILE_FIELDS) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (Object.keys(updatePayload).length === 1) {
      return reply.code(400).send({ error: 'Không có dữ liệu để cập nhật' });
    }

    const { data, error } = await request.server.supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return reply.code(404).send({ error: 'Không tìm thấy người dùng' });
      }
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }

    return reply.code(200).send({
      message: 'Cập nhật người dùng thành công',
      data,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Lỗi máy chủ nội bộ' });
  }
};

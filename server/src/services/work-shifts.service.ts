import type { FastifyInstance } from 'fastify';
import type {
  AssignUserWorkShiftBody,
  UserWorkShiftAssignment,
  UserWorkShiftAssignmentHistory,
} from '../interfaces/work-shifts';
import { fail } from './master-data.helpers';

const WORK_SHIFT_SELECT = `
  id, code, name, start_time, end_time, crosses_midnight,
  is_system, is_active, is_deleted, created_at, updated_at
`;

const ASSIGNMENT_SELECT = `
  id, user_id, work_shift_id, effective_from, effective_to, assigned_by,
  is_active, is_deleted, created_at, updated_at,
  work_shift:work_shifts!user_work_shift_assignments_work_shift_id_fkey(
    ${WORK_SHIFT_SELECT}
  ),
  user:users!user_work_shift_assignments_user_id_fkey(
    id, vinfast_id, email, first_name, last_name
  ),
  assigned_by_user:users!user_work_shift_assignments_assigned_by_fkey(
    id, vinfast_id, email, first_name, last_name
  )
`;

const assignmentError = (message?: string): never => {
  switch (message) {
    case 'WORK_SHIFT_ASSIGNMENT_FORBIDDEN':
      return fail(403, 'Bạn không có permission để gán ca làm việc');
    case 'WORK_SHIFT_USER_NOT_FOUND':
      return fail(404, 'Người dùng không tồn tại hoặc không hoạt động');
    case 'WORK_SHIFT_NOT_AVAILABLE':
      return fail(400, 'Ca làm việc không tồn tại hoặc không hoạt động');
    case 'WORK_SHIFT_EFFECTIVE_FROM_INVALID':
      return fail(400, 'Thời điểm hiệu lực không hợp lệ');
    default:
      return fail(400, 'Không thể cập nhật ca làm việc của người dùng');
  }
};

export class WorkShiftsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async listActive() {
    const { data, error } = await this.db
      .from('work_shifts')
      .select(WORK_SHIFT_SELECT)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true })
      .order('code', { ascending: true });

    if (error) fail(400, 'Không thể tải danh sách ca làm việc');
    return data ?? [];
  }

  async getAssignmentHistory(userId: string): Promise<UserWorkShiftAssignmentHistory> {
    const { data, error } = await this.db
      .from('user_work_shift_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('effective_from', { ascending: false });

    if (error) fail(400, 'Không thể tải lịch sử ca làm việc');
    const history = (data ?? []) as unknown as UserWorkShiftAssignment[];
    return {
      current: history.find((assignment) => assignment.is_active) ?? null,
      history,
    };
  }

  async assign(
    body: AssignUserWorkShiftBody,
    actorId: string,
  ): Promise<UserWorkShiftAssignment> {
    const { data: assignmentId, error } = await this.db.rpc('assign_user_work_shift', {
      p_user_id: body.user_id,
      p_work_shift_id: body.work_shift_id,
      p_effective_from: body.effective_from,
      p_actor_id: actorId,
    });

    if (error) assignmentError(error.message);
    if (typeof assignmentId !== 'string') {
      fail(500, 'Database không trả về assignment vừa cập nhật');
    }

    const { data, error: readError } = await this.db
      .from('user_work_shift_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('id', assignmentId)
      .single();

    if (readError || !data) fail(500, 'Không thể tải assignment vừa cập nhật');
    return data as unknown as UserWorkShiftAssignment;
  }
}

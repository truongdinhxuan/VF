import type { FastifyInstance } from 'fastify';
import { normalizeRoleName } from '../domain/enums';
import type { CreateRoleBody, UpdateRoleBody } from '../interfaces/master-data';
import { databaseError, fail } from './master-data.helpers';

const SELECT = 'id, role_name';

export class RolesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list() {
    const { data, error } = await this.db
      .from('roles')
      .select(SELECT)
      .order('role_name', { ascending: true });
    if (error) databaseError(error, 'Không thể lấy danh sách role');
    return data ?? [];
  }

  async get(id: string) {
    const { data, error } = await this.db.from('roles').select(SELECT).eq('id', id).single();
    if (error || !data) databaseError(error, 'Không tìm thấy role');
    return data;
  }

  async create(body: CreateRoleBody) {
    const roleName = normalizeRoleName(body.role_name);
    if (!roleName) fail(400, 'role_name không thuộc danh sách role được cấu hình');
    const { data, error } = await this.db
      .from('roles')
      .insert({ role_name: roleName })
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'role_name đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateRoleBody) {
    const roleName = normalizeRoleName(body.role_name);
    if (!roleName) fail(400, 'role_name không thuộc danh sách role được cấu hình');
    const { data, error } = await this.db
      .from('roles')
      .update({ role_name: roleName })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật role hoặc role_name đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { count, error: usageError } = await this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id);
    if (usageError) databaseError(usageError, 'Không thể kiểm tra role đang được sử dụng');
    if ((count ?? 0) > 0) fail(409, 'Không thể xóa role đang được user sử dụng');

    const { data, error } = await this.db
      .from('roles')
      .delete()
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy role');
    return data;
  }
}

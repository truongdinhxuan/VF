import type { FastifyInstance } from 'fastify';
import { normalizeRoleCode } from '../domain/enums';
import type { CreateRoleBody, UpdateRoleBody } from '../interfaces/master-data';
import type { RoleListQuery } from '../interfaces/master-data';
import { ROLE_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import {
  databaseError,
  fail,
  normalizeOptionalText,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';

const SELECT = `
  id, code, name, description, is_system, is_active, is_deleted, created_at, updated_at
`;

export class RolesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: RoleListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: ROLE_SORT_FIELDS,
      defaultSortBy: 'code',
      defaultSortOrder: 'asc',
    });
    const active = parseActiveFilter(query.isActive);
    let request = this.db
      .from('roles')
      .select(SELECT, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_active', active);
    if (pagination.search) {
      request = request.or([
        `code.ilike.*${pagination.search}*`,
        `name.ilike.*${pagination.search}*`,
        `description.ilike.*${pagination.search}*`,
      ].join(','));
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách role');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from('roles')
      .select(SELECT)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy role');
    return data;
  }

  async create(body: CreateRoleBody) {
    const code = normalizeRoleCode(body.code);
    if (!code) fail(400, 'code không thuộc danh sách role được cấu hình');
    const { data, error } = await this.db
      .from('roles')
      .insert({
        code,
        name: normalizeRequiredText(body.name, 'name'),
        description: normalizeOptionalText(body.description, 'description') ?? null,
        is_system: true,
        is_active: body.is_active ?? true,
        is_deleted: false,
      })
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'code role đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateRoleBody) {
    const { data: current, error: currentError } = await this.db
      .from('roles')
      .select('id, code, is_system')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (currentError || !current) {
      return databaseError(currentError, 'Không tìm thấy role');
    }

    const payload: Record<string, unknown> = {};
    if (body.code !== undefined) {
      const code = normalizeRoleCode(body.code);
      if (!code) fail(400, 'code không thuộc danh sách role được cấu hình');
      if (current.is_system && code !== current.code) {
        fail(409, 'Không thể thay đổi code của role hệ thống');
      }
      payload.code = code;
    }
    if (body.name !== undefined) payload.name = normalizeRequiredText(body.name, 'name');
    if (body.description !== undefined) {
      payload.description = normalizeOptionalText(body.description, 'description');
    }
    if (body.is_active !== undefined) payload.is_active = body.is_active;
    if (Object.keys(payload).length === 0) fail(400, 'Không có dữ liệu để cập nhật');

    const { data, error } = await this.db
      .from('roles')
      .update(payload)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật role hoặc code đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { data: role, error: roleError } = await this.db
      .from('roles')
      .select('id, is_system')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (roleError || !role) {
      return databaseError(roleError, 'Không tìm thấy role');
    }
    if (role.is_system) fail(409, 'Không thể xóa role hệ thống');

    const { count, error: usageError } = await this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id);
    if (usageError) databaseError(usageError, 'Không thể kiểm tra role đang được sử dụng');
    if ((count ?? 0) > 0) fail(409, 'Không thể xóa role đang được user sử dụng');

    const { data, error } = await this.db
      .from('roles')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy role');
    return data;
  }
}

import type { FastifyInstance } from 'fastify';
import { normalizeRoleName, ROLE_NAMES } from '../domain/enums';
import type { CreateRoleBody, UpdateRoleBody } from '../interfaces/master-data';
import type { RoleListQuery } from '../interfaces/master-data';
import { ROLE_SORT_FIELDS } from '../schemas/master-data';
import { createPaginatedResult, parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import { databaseError, fail } from './master-data.helpers';

const SELECT = 'id, role_name';

export class RolesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: RoleListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: ROLE_SORT_FIELDS,
      defaultSortBy: 'role_name',
      defaultSortOrder: 'asc',
    });
    let request = this.db
      .from('roles')
      .select(SELECT, { count: 'exact' });
    if (pagination.search) {
      const normalizedSearch = pagination.search.toLocaleLowerCase('vi');
      const matchingRoles = ROLE_NAMES.filter((roleName) =>
        roleName.toLocaleLowerCase('vi').includes(normalizedSearch),
      );
      if (matchingRoles.length === 0) {
        return createPaginatedResult([], pagination, 0);
      }
      request = request.in('role_name', matchingRoles);
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

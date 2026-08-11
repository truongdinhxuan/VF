import type { FastifyInstance } from 'fastify';
import type {
  PermissionListQuery,
  ReplaceRolePermissionsBody,
  ReplaceUserRolesBody,
} from '../interfaces/rbac';
import { PERMISSION_SORT_FIELDS } from '../schemas/rbac';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import { databaseError, fail } from './master-data.helpers';

const PERMISSION_SELECT = `
  id, code, name, module, description, is_system, is_active, is_deleted,
  created_at, updated_at
`;
const ROLE_SELECT = `
  id, code, name, description, is_system, is_active, is_deleted,
  created_at, updated_at
`;

export class RbacService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() { return this.fastify.supabaseAdmin; }

  async listPermissions(query: PermissionListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: PERMISSION_SORT_FIELDS,
      defaultSortBy: 'module',
      defaultSortOrder: 'asc',
    });
    let request = this.db
      .from('permissions')
      .select(PERMISSION_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_deleted', false);
    if (pagination.search) {
      request = request.or([
        `code.ilike.*${pagination.search}*`,
        `name.ilike.*${pagination.search}*`,
        `description.ilike.*${pagination.search}*`,
      ].join(','));
    }
    if (query.module) request = request.eq('module', query.module.trim());
    request = request
      .order(pagination.sortBy, { ascending: pagination.sortOrder === 'asc' });
    if (pagination.sortBy !== 'code') request = request.order('code', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách permission');
    throw new Error('Unreachable pagination state');
  }

  async getRolePermissions(roleId: string) {
    const { data: role, error: roleError } = await this.db
      .from('roles').select('id').eq('id', roleId).eq('is_deleted', false).maybeSingle();
    if (roleError || !role) fail(404, 'Không tìm thấy role');
    const { data, error } = await this.db
      .from('role_permissions')
      .select(`permission:permissions!role_permissions_permission_id_fkey!inner(${PERMISSION_SELECT})`)
      .eq('role_id', roleId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('permission.is_active', true)
      .eq('permission.is_deleted', false);
    if (error) databaseError(error, 'Không thể lấy permission của role');
    return (data ?? []).map((row) => {
      const value = row.permission as unknown;
      return Array.isArray(value) ? value[0] : value;
    }).filter(Boolean);
  }

  async replaceRolePermissions(
    roleId: string,
    body: ReplaceRolePermissionsBody,
    actorId: string,
  ) {
    const permissionIds = [...new Set(body.permission_ids)];
    const { error } = await this.db.rpc('replace_role_permissions', {
      p_role_id: roleId,
      p_permission_ids: permissionIds,
      p_actor_id: actorId,
    });
    if (error) databaseError(error, 'Không thể cập nhật permission của role');
    return this.getRolePermissions(roleId);
  }

  async getUserRoles(userId: string) {
    const { data: user, error: userError } = await this.db
      .from('users').select('id').eq('id', userId).eq('is_deleted', false).maybeSingle();
    if (userError || !user) fail(404, 'Không tìm thấy người dùng');
    const { data, error } = await this.db
      .from('user_roles')
      .select(`role:roles!user_roles_role_id_fkey!inner(${ROLE_SELECT})`)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('role.is_active', true)
      .eq('role.is_deleted', false);
    if (error) databaseError(error, 'Không thể lấy role của người dùng');
    return (data ?? []).map((row) => {
      const value = row.role as unknown;
      return Array.isArray(value) ? value[0] : value;
    }).filter(Boolean);
  }

  async replaceUserRoles(userId: string, body: ReplaceUserRolesBody, actorId: string) {
    const roleIds = [...new Set(body.role_ids)];
    if (roleIds.length === 0) fail(400, 'Người dùng phải có ít nhất một role');
    const { error } = await this.db.rpc('replace_user_roles', {
      p_user_id: userId,
      p_role_ids: roleIds,
      p_actor_id: actorId,
    });
    if (error) databaseError(error, 'Không thể cập nhật role của người dùng');
    return this.getUserRoles(userId);
  }
}

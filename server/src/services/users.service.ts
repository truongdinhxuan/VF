import type { FastifyInstance } from 'fastify';
import { normalizeRoleCode } from '../domain/enums';
import type {
  AreaRecord,
  RoleRecord,
  UserRecord,
} from '../interfaces/database';
import type {
  CreateUserBody,
  UpdateUserBody,
  UserListQuery,
} from '../interfaces/users';
import { USER_COLUMNS } from '../interfaces/users';
import { USER_SORT_FIELDS } from '../schemas/users';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

export class UsersServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'UsersServiceError';
  }
}

const userFail = (statusCode: number, message: string): never => {
  throw new UsersServiceError(statusCode, message);
};

const userDatabaseError = (
  error: SupabaseErrorLike | null,
  fallback: string,
): never => {
  if (error?.code === 'PGRST116') return userFail(404, 'Không tìm thấy người dùng');
  if (error?.code === '23505') {
    if (/email/i.test(error.message ?? '')) return userFail(409, 'Email đã tồn tại');
    if (/vinfast/i.test(error.message ?? '')) return userFail(409, 'VinFast ID đã tồn tại');
    return userFail(409, 'Email hoặc VinFast ID đã tồn tại');
  }
  if (error?.code === '23503') {
    return userFail(400, 'role_id, area_id hoặc managed_by_user_id không hợp lệ');
  }
  return userFail(400, error?.message ?? fallback);
};

const normalizeRequiredText = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) userFail(400, `${field} không được để trống`);
  return normalized;
};

const normalizeNullableText = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
};

const parseUserActiveFilter = (
  value: string | boolean | undefined,
): boolean | null => {
  if (value === undefined || value === '') return null;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return userFail(400, 'isActive phải là true hoặc false');
};

export const USER_COLUMN_SELECT = USER_COLUMNS.join(', ');

export const USER_EXPANDED_SELECT = `
  ${USER_COLUMN_SELECT},
  role:roles!users_role_id_fkey(id, code, name, is_active, is_deleted),
  area:areas!users_area_id_fkey(id, code, name, is_active)
`;

interface UserProfileRecord extends UserRecord {
  role: Pick<RoleRecord, 'id' | 'code' | 'name' | 'is_active' | 'is_deleted'> | null;
  area: Pick<AreaRecord, 'id' | 'code' | 'name' | 'is_active'> | null;
}

export class UsersService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  private async assertUniqueFields(
    email: string,
    vinfastId: number,
    excludeId?: string,
  ): Promise<void> {
    let emailQuery = this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);
    let vinfastQuery = this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('vinfast_id', vinfastId);

    if (excludeId) {
      emailQuery = emailQuery.neq('id', excludeId);
      vinfastQuery = vinfastQuery.neq('id', excludeId);
    }

    const [emailResult, vinfastResult] = await Promise.all([
      emailQuery,
      vinfastQuery,
    ]);
    if (emailResult.error) {
      userDatabaseError(emailResult.error, 'Không thể kiểm tra email');
    }
    if (vinfastResult.error) {
      userDatabaseError(vinfastResult.error, 'Không thể kiểm tra VinFast ID');
    }
    if ((emailResult.count ?? 0) > 0) userFail(409, 'Email đã tồn tại');
    if ((vinfastResult.count ?? 0) > 0) userFail(409, 'VinFast ID đã tồn tại');
  }

  private async assertConfiguredRole(roleId: string): Promise<void> {
    const { data, error } = await this.db
      .from('roles')
      .select('code')
      .eq('id', roleId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();
    if (error || !normalizeRoleCode(data?.code)) {
      userFail(400, 'role_id không thuộc một trong 5 role hợp lệ');
    }
  }

  private async assertArea(areaId: string): Promise<void> {
    const { data, error } = await this.db
      .from('areas')
      .select('id')
      .eq('id', areaId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();
    if (error || !data) userFail(400, 'area_id không tồn tại hoặc không active');
  }

  private async assertManager(managerId: string): Promise<void> {
    const { data, error } = await this.db
      .from('users')
      .select('id')
      .eq('id', managerId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .single();
    if (error || !data) {
      userFail(400, 'managed_by_user_id không tồn tại hoặc không active');
    }
  }

  private async validateReferences(
    body: Pick<CreateUserBody, 'role_id' | 'area_id' | 'managed_by_user_id'>
      | Pick<UpdateUserBody, 'role_id' | 'area_id' | 'managed_by_user_id'>,
  ): Promise<void> {
    const checks: Promise<void>[] = [];
    if (body.role_id !== undefined) checks.push(this.assertConfiguredRole(body.role_id));
    if (body.area_id !== undefined) checks.push(this.assertArea(body.area_id));
    if (body.managed_by_user_id) checks.push(this.assertManager(body.managed_by_user_id));
    await Promise.all(checks);
  }

  async list(query: UserListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: USER_SORT_FIELDS,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });
    const active = parseUserActiveFilter(query.isActive);
    let request = this.db
      .from('users')
      .select(USER_EXPANDED_SELECT, { count: 'exact' })
      .eq('is_deleted', false);
    if (pagination.search) {
      const conditions = [
        `email.ilike.*${pagination.search}*`,
        `first_name.ilike.*${pagination.search}*`,
        `last_name.ilike.*${pagination.search}*`,
      ];
      if (/^-?\d+$/.test(pagination.search)) {
        conditions.push(`vinfast_id.eq.${Number(pagination.search)}`);
      }
      request = request.or(conditions.join(','));
    }
    if (query.roleId) request = request.eq('role_id', query.roleId);
    if (query.areaId) request = request.eq('area_id', query.areaId);
    if (active !== null) request = request.eq('is_active', active);
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult(
      { data: (data ?? null) as unknown as UserProfileRecord[] | null, error, count },
      pagination,
    );
    if (result) return result;
    if (error) userDatabaseError(error, 'Không thể lấy danh sách người dùng');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string): Promise<UserProfileRecord> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_EXPANDED_SELECT)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (error || !data) userDatabaseError(error, 'Không tìm thấy người dùng');
    return data as unknown as UserProfileRecord;
  }

  async create(body: CreateUserBody) {
    const email = normalizeRequiredText(body.email, 'email').toLowerCase();
    const firstName = normalizeRequiredText(body.first_name, 'first_name');
    const lastName = normalizeRequiredText(body.last_name, 'last_name');

    await this.assertUniqueFields(email, body.vinfast_id);
    await this.validateReferences(body);

    const { data: authData, error: authError } =
      await this.db.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          is_verified: false,
        },
      });

    if (authError || !authData.user) {
      const statusCode = /already|exists/i.test(authError?.message ?? '') ? 409 : 400;
      return userFail(statusCode, authError?.message ?? 'Không thể tạo Supabase Auth user');
    }

    const userId = authData.user.id;
    const { data: publicData, error: publicError } = await this.db
      .from('users')
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        vinfast_id: body.vinfast_id,
        phone_number: normalizeNullableText(body.phone_number) ?? null,
        avatar_url: normalizeNullableText(body.avatar_url) ?? null,
        role_id: body.role_id,
        area_id: body.area_id,
        managed_by_user_id: body.managed_by_user_id ?? null,
        is_verified: false,
        is_active: true,
        is_deleted: false,
      })
      .select(USER_EXPANDED_SELECT)
      .single();

    if (publicError || !publicData) {
      const { error: cleanupError } = await this.db.auth.admin.deleteUser(userId);
      if (cleanupError) {
        this.fastify.log.error(cleanupError);
        userFail(
          500,
          `Không thể tạo profile public.users: ${publicError?.message ?? 'unknown error'}. Không thể rollback Auth user: ${cleanupError.message}`,
        );
      }
      userDatabaseError(
        publicError,
        `Không thể tạo profile public.users: ${publicError?.message ?? 'unknown error'}`,
      );
    }

    return {
      id: userId,
      email,
      publicData: publicData as unknown as UserProfileRecord,
    };
  }

  async update(id: string, body: UpdateUserBody): Promise<UserProfileRecord> {
    const { data: current, error: currentError } = await this.db
      .from('users')
      .select(USER_COLUMN_SELECT)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    const currentUser = current as unknown as UserRecord | null;
    if (currentError || !currentUser) {
      return userDatabaseError(currentError, 'Không tìm thấy người dùng');
    }

    await this.validateReferences(body);

    const payload: Record<string, unknown> = {};
    if (body.email !== undefined) {
      payload.email = normalizeRequiredText(body.email, 'email').toLowerCase();
    }
    if (body.first_name !== undefined) {
      payload.first_name = normalizeRequiredText(body.first_name, 'first_name');
    }
    if (body.last_name !== undefined) {
      payload.last_name = normalizeRequiredText(body.last_name, 'last_name');
    }
    if (body.vinfast_id !== undefined) payload.vinfast_id = body.vinfast_id;
    if (body.phone_number !== undefined) {
      payload.phone_number = normalizeNullableText(body.phone_number);
    }
    if (body.avatar_url !== undefined) {
      payload.avatar_url = normalizeNullableText(body.avatar_url);
    }
    if (body.role_id !== undefined) payload.role_id = body.role_id;
    if (body.area_id !== undefined) payload.area_id = body.area_id;
    if (body.managed_by_user_id !== undefined) {
      payload.managed_by_user_id = body.managed_by_user_id;
    }
    if (body.is_active !== undefined) payload.is_active = body.is_active;
    if (body.is_verified !== undefined) payload.is_verified = body.is_verified;
    if (body.is_deleted !== undefined) payload.is_deleted = body.is_deleted;

    if (Object.keys(payload).length === 0) userFail(400, 'Không có dữ liệu để cập nhật');

    const nextEmail = (payload.email as string | undefined) ?? currentUser.email;
    const nextVinfastId = (payload.vinfast_id as number | undefined) ?? currentUser.vinfast_id;
    if (nextEmail !== currentUser.email || nextVinfastId !== currentUser.vinfast_id) {
      await this.assertUniqueFields(nextEmail, nextVinfastId, id);
    }

    let authEmailChanged = false;
    if (nextEmail !== currentUser.email) {
      const { error: authError } = await this.db.auth.admin.updateUserById(id, {
        email: nextEmail,
        email_confirm: true,
      });
      if (authError) userFail(400, authError.message);
      authEmailChanged = true;
    }

    const { data, error } = await this.db
      .from('users')
      .update(payload)
      .eq('id', id)
      .select(USER_EXPANDED_SELECT)
      .single();

    if (error || !data) {
      if (authEmailChanged) {
        const { error: rollbackError } = await this.db.auth.admin.updateUserById(id, {
          email: currentUser.email,
          email_confirm: true,
        });
        if (rollbackError) this.fastify.log.error(rollbackError);
      }
      userDatabaseError(error, 'Không thể cập nhật người dùng');
    }

    return data as unknown as UserProfileRecord;
  }

  async deactivate(id: string): Promise<UserProfileRecord> {
    const { data, error } = await this.db
      .from('users')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(USER_EXPANDED_SELECT)
      .single();
    if (error || !data) userDatabaseError(error, 'Không tìm thấy người dùng');
    return data as unknown as UserProfileRecord;
  }
}

export const getUserProfileById = async (
  fastify: FastifyInstance,
  userId: string,
): Promise<UserProfileRecord | null> => {
  try {
    return await new UsersService(fastify).get(userId);
  } catch (error) {
    fastify.log.warn(
      `Không lấy được dữ liệu cho user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return null;
  }
};

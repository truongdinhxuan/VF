import type { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeRoleName, ROLE_NAMES, type RoleName } from '../domain/enums';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      role: RoleName;
      areaId: string;
    };
  }
}

interface RoleRelation {
  role_name: string;
}

interface PublicUserAuthData {
  area_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  role: RoleRelation | RoleRelation[] | null;
}

const extractRoleName = (relation: PublicUserAuthData['role']): string | null => {
  if (Array.isArray(relation)) {
    return relation[0]?.role_name ?? null;
  }
  return relation?.role_name ?? null;
};

export const verifyTokenAndRole = (allowedRoles: readonly RoleName[] = []) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;

    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Vui lòng cung cấp Bearer token hợp lệ' });
      }

      const token = authHeader.slice('Bearer '.length);
      const { data: authData, error: authError } =
        await request.server.supabase.auth.getUser(token);

      if (authError || !authData.user) {
        return reply.code(401).send({ error: 'Token đã hết hạn hoặc không hợp lệ' });
      }

      const { data, error } = await request.server.supabaseAdmin
        .from('users')
        .select('area_id, is_active, is_verified, role:roles!users_role_id_fkey(role_name)')
        .eq('id', authData.user.id)
        .single();

      const publicData = data as PublicUserAuthData | null;
      const roleName = normalizeRoleName(extractRoleName(publicData?.role ?? null));

      if (error || !publicData || !publicData.is_active) {
        return reply.code(403).send({
          error: 'Hồ sơ người dùng không tồn tại hoặc đã bị khóa',
        });
      }

      if (!publicData.is_verified) {
        return reply.code(403).send({
          error: 'Tài khoản chưa được duyệt để truy cập dữ liệu nội bộ',
          code: 'ACCOUNT_NOT_VERIFIED',
        });
      }

      if (!roleName || !ROLE_NAMES.includes(roleName) || !publicData.area_id) {
        return reply.code(403).send({
          error: 'Người dùng chưa được gán role hoặc area hợp lệ',
        });
      }

      const role = roleName;
      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return reply.code(403).send({
          error: 'Bạn không có quyền truy cập chức năng này',
        });
      }

      request.user = {
        id: authData.user.id,
        email: authData.user.email,
        role,
        areaId: publicData.area_id,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Lỗi máy chủ trong quá trình xác thực' });
    }
  };
};

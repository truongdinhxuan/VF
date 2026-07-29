import type { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeRoleCode, ROLE_CODES, type RoleCode } from '../domain/enums';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      role: RoleCode;
      areaId: string;
    };
  }
}

interface RoleRelation {
  code: string;
  is_active: boolean;
  is_deleted: boolean;
}

interface PublicUserAuthData {
  area_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_deleted: boolean;
  role: RoleRelation | RoleRelation[] | null;
}

const extractRoleCode = (relation: PublicUserAuthData['role']): string | null => {
  if (Array.isArray(relation)) {
    return relation[0]?.code ?? null;
  }
  return relation?.code ?? null;
};

export const verifyTokenAndRole = (allowedRoles: readonly RoleCode[] = []) => {
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
        .select(
          'area_id, is_active, is_verified, is_deleted, role:roles!users_role_id_fkey(code, is_active, is_deleted)',
        )
        .eq('id', authData.user.id)
        .single();

      const publicData = data as PublicUserAuthData | null;
      const roleRelation = Array.isArray(publicData?.role)
        ? publicData.role[0] ?? null
        : publicData?.role ?? null;
      const roleCode = normalizeRoleCode(extractRoleCode(publicData?.role ?? null));

      if (error || !publicData || !publicData.is_active || publicData.is_deleted) {
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

      if (
        !roleCode ||
        !ROLE_CODES.includes(roleCode) ||
        !roleRelation?.is_active ||
        roleRelation.is_deleted ||
        !publicData.area_id
      ) {
        return reply.code(403).send({
          error: 'Người dùng chưa được gán role hoặc area hợp lệ',
        });
      }

      const role = roleCode;
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

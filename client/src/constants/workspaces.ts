import { ROLE_CODE, type RoleCode } from './roles';

export interface RoleWorkspace {
  role: RoleCode;
  basePath: string;
  dashboardLabel: string;
  dashboardDescription: string;
}

export const ROLE_WORKSPACES: Record<RoleCode, RoleWorkspace> = {
  [ROLE_CODE.ADMIN]: {
    role: ROLE_CODE.ADMIN,
    basePath: '/admin',
    dashboardLabel: 'Admin dashboard',
    dashboardDescription: 'Quản trị hệ thống, người dùng và toàn bộ nghiệp vụ.',
  },
  [ROLE_CODE.MATERIAL_LEADER]: {
    role: ROLE_CODE.MATERIAL_LEADER,
    basePath: '/teamlead',
    dashboardLabel: 'Team leader dashboard',
    dashboardDescription: 'Theo dõi order, tồn kho và hoạt động cấp vật tư.',
  },
  [ROLE_CODE.DATA_MATERIAL]: {
    role: ROLE_CODE.DATA_MATERIAL,
    basePath: '/datavt',
    dashboardLabel: 'Data vật tư dashboard',
    dashboardDescription: 'Tiếp nhận, duyệt và thực hiện nghiệp vụ cấp vật tư.',
  },
  [ROLE_CODE.DATA_PACKING]: {
    role: ROLE_CODE.DATA_PACKING,
    basePath: '/datadg',
    dashboardLabel: 'Data đóng gói dashboard',
    dashboardDescription: 'Tạo và theo dõi order của khu vực được phân công.',
  },
  [ROLE_CODE.MATERIAL_CONTROL]: {
    role: ROLE_CODE.MATERIAL_CONTROL,
    basePath: '/material-control',
    dashboardLabel: 'Material Control dashboard',
    dashboardDescription: 'Theo dõi, phê duyệt và phân tích hoạt động vật tư.',
  },
};

export const getRoleWorkspace = (
  role: RoleCode | null | undefined,
): RoleWorkspace | null => (role ? ROLE_WORKSPACES[role] : null);

export const getRoleBasePath = (
  role: RoleCode | null | undefined,
): string => getRoleWorkspace(role)?.basePath ?? '/';

export const getRoleHomePath = (
  role: RoleCode | null | undefined,
): string => {
  const workspace = getRoleWorkspace(role);
  return workspace ? `${workspace.basePath}/dashboard` : '/403-unauthorized';
};

export const getWorkspacePath = (
  role: RoleCode | null | undefined,
  relativePath = '',
): string => {
  const basePath = getRoleBasePath(role);
  const normalizedPath = relativePath.replace(/^\/+/, '');
  return normalizedPath ? `${basePath}/${normalizedPath}` : basePath;
};

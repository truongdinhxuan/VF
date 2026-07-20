import type { RoleName } from './enums';

export const PACKING_ROLE: RoleName = 'data Đóng gói';
export const MATERIAL_DATA_ROLE: RoleName = 'data Vật tư';
export const MATERIAL_LEAD_ROLE: RoleName = 'Tổ trưởng vật tư';
export const MATERIAL_CONTROL_ROLE: RoleName = 'Material Control';
export const ADMIN_ROLE: RoleName = 'Admin';

export const MATERIAL_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
];

export const STOCK_VIEWER_ROLES: readonly RoleName[] = [
  ...MATERIAL_ROLES,
  ADMIN_ROLE,
];

export const STOCK_MUTATOR_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
];

export const ORDER_APPROVER_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
];

export const ORDER_ISSUER_ROLES: readonly RoleName[] = STOCK_MUTATOR_ROLES;

export const USER_MANAGER_ROLES: readonly RoleName[] = [ADMIN_ROLE];
export const SYSTEM_MANAGER_ROLES: readonly RoleName[] = [ADMIN_ROLE];
export const MASTER_DATA_MANAGER_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  ADMIN_ROLE,
];

export const canCreateOrder = (role: RoleName): boolean => role === PACKING_ROLE;

export const canApproveOrder = (role: RoleName): boolean =>
  ORDER_APPROVER_ROLES.includes(role);

export const canIssueOrder = (role: RoleName): boolean =>
  ORDER_ISSUER_ROLES.includes(role);

export const canViewStock = (role: RoleName): boolean =>
  STOCK_VIEWER_ROLES.includes(role);

export const canMutateStock = (role: RoleName): boolean =>
  STOCK_MUTATOR_ROLES.includes(role);

export const canManageUsers = (role: RoleName): boolean =>
  USER_MANAGER_ROLES.includes(role);

export const canManageSystem = (role: RoleName): boolean =>
  SYSTEM_MANAGER_ROLES.includes(role);

export const canManageMasterData = (role: RoleName): boolean =>
  MASTER_DATA_MANAGER_ROLES.includes(role);

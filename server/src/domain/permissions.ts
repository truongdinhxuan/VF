import { ROLE_CODE, type RoleCode } from './enums';

export const PACKING_ROLE: RoleCode = ROLE_CODE.DATA_PACKING;
export const MATERIAL_DATA_ROLE: RoleCode = ROLE_CODE.DATA_MATERIAL;
export const MATERIAL_LEAD_ROLE: RoleCode = ROLE_CODE.MATERIAL_LEADER;
export const MATERIAL_CONTROL_ROLE: RoleCode = ROLE_CODE.MATERIAL_CONTROL;
export const ADMIN_ROLE: RoleCode = ROLE_CODE.ADMIN;

export const MATERIAL_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
];

export const STOCK_VIEWER_ROLES: readonly RoleCode[] = [
  ...MATERIAL_ROLES,
  ADMIN_ROLE,
];

export const STOCK_MUTATOR_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
  ADMIN_ROLE,
];

export const ORDER_APPROVER_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
  ADMIN_ROLE,
];

export const ORDER_ISSUER_ROLES: readonly RoleCode[] = STOCK_MUTATOR_ROLES;

export const USER_MANAGER_ROLES: readonly RoleCode[] = [ADMIN_ROLE];
export const USER_VIEWER_ROLES: readonly RoleCode[] = [
  MATERIAL_CONTROL_ROLE,
  ADMIN_ROLE,
];
export const SYSTEM_MANAGER_ROLES: readonly RoleCode[] = [ADMIN_ROLE];
export const MASTER_DATA_MANAGER_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  ADMIN_ROLE,
];

export const canCreateOrder = (role: RoleCode): boolean =>
  role === PACKING_ROLE || role === ADMIN_ROLE;

export const canApproveOrder = (role: RoleCode): boolean =>
  ORDER_APPROVER_ROLES.includes(role);

export const canIssueOrder = (role: RoleCode): boolean =>
  ORDER_ISSUER_ROLES.includes(role);

export const canViewStock = (role: RoleCode): boolean =>
  STOCK_VIEWER_ROLES.includes(role);

export const canMutateStock = (role: RoleCode): boolean =>
  STOCK_MUTATOR_ROLES.includes(role);

export const canManageUsers = (role: RoleCode): boolean =>
  USER_MANAGER_ROLES.includes(role);

export const canManageSystem = (role: RoleCode): boolean =>
  SYSTEM_MANAGER_ROLES.includes(role);

export const canManageMasterData = (role: RoleCode): boolean =>
  MASTER_DATA_MANAGER_ROLES.includes(role);

import type { RoleName } from './enums';

export const PACKING_ROLE: RoleName = 'data Đóng gói';
export const MATERIAL_DATA_ROLE: RoleName = 'data Vật tư';
export const MATERIAL_LEAD_ROLE: RoleName = 'Tổ trưởng vật tư';
export const MATERIAL_CONTROL_ROLE: RoleName = 'Material Control';

export const MATERIAL_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
];

export const ORDER_APPROVER_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
];

export const ORDER_ISSUER_ROLES: readonly RoleName[] = MATERIAL_ROLES;

export const canCreateOrder = (role: RoleName): boolean => role === PACKING_ROLE;

export const canApproveOrder = (role: RoleName): boolean =>
  ORDER_APPROVER_ROLES.includes(role);

export const canIssueOrder = (role: RoleName): boolean =>
  ORDER_ISSUER_ROLES.includes(role);

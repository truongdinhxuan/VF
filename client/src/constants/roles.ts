export const ROLE_NAMES = [
  'data Đóng gói',
  'data Vật tư',
  'Tổ trưởng vật tư',
  'Material Control',
  'Admin',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

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
export const USER_MANAGEMENT_ROLES: readonly RoleName[] = [ADMIN_ROLE];
export const SYSTEM_MANAGEMENT_ROLES: readonly RoleName[] = [ADMIN_ROLE];
export const MASTER_DATA_MANAGER_ROLES: readonly RoleName[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  ADMIN_ROLE,
];

const extractRoleCandidate = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return extractRoleCandidate(value[0]);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.role_name === 'string') return record.role_name;
  }
  return null;
};

export const resolveRoleName = (value: unknown): RoleName | null => {
  const candidate = extractRoleCandidate(value)?.trim();
  return candidate && ROLE_NAMES.includes(candidate as RoleName)
    ? candidate as RoleName
    : null;
};

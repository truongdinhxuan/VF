export const ROLE_CODE = {
  ADMIN: 'ADMIN',
  DATA_PACKING: 'DATA_PACKING',
  DATA_MATERIAL: 'DATA_MATERIAL',
  MATERIAL_LEADER: 'MATERIAL_LEADER',
  MATERIAL_CONTROL: 'MATERIAL_CONTROL',
} as const;

export type RoleCode = (typeof ROLE_CODE)[keyof typeof ROLE_CODE];

export const ROLE_CODES = Object.values(ROLE_CODE) as RoleCode[];

export const PACKING_ROLE: RoleCode = ROLE_CODE.DATA_PACKING;
export const MATERIAL_DATA_ROLE: RoleCode = ROLE_CODE.DATA_MATERIAL;
export const MATERIAL_LEAD_ROLE: RoleCode = ROLE_CODE.MATERIAL_LEADER;
export const MATERIAL_CONTROL_ROLE: RoleCode = ROLE_CODE.MATERIAL_CONTROL;
export const ADMIN_ROLE: RoleCode = ROLE_CODE.ADMIN;

export const ORDER_CREATOR_ROLES: readonly RoleCode[] = [PACKING_ROLE, ADMIN_ROLE];

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

export const USER_VIEWER_ROLES: readonly RoleCode[] = [
  MATERIAL_CONTROL_ROLE,
  ADMIN_ROLE,
];
export const USER_MANAGEMENT_ROLES: readonly RoleCode[] = [ADMIN_ROLE];
export const SYSTEM_MANAGEMENT_ROLES: readonly RoleCode[] = [ADMIN_ROLE];
export const MASTER_DATA_VIEWER_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
  ADMIN_ROLE,
];
export const MASTER_DATA_MANAGER_ROLES: readonly RoleCode[] = [
  MATERIAL_DATA_ROLE,
  MATERIAL_LEAD_ROLE,
  ADMIN_ROLE,
];

const extractRoleCode = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return extractRoleCode(value[0]);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.code === 'string') return record.code;
  }
  return null;
};

export const resolveRoleCode = (value: unknown): RoleCode | null => {
  const candidate = extractRoleCode(value)?.trim();
  return candidate && ROLE_CODES.includes(candidate as RoleCode)
    ? candidate as RoleCode
    : null;
};

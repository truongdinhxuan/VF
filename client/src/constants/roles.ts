export const ROLE_CODE = {
  ADMIN: 'ADMIN',
  DATA_PACKING: 'DATA_PACKING',
  DATA_MATERIAL: 'DATA_MATERIAL',
  MATERIAL_LEADER: 'MATERIAL_LEADER',
  MATERIAL_CONTROL: 'MATERIAL_CONTROL',
} as const;

export type RoleCode = (typeof ROLE_CODE)[keyof typeof ROLE_CODE];

export const ROLE_CODES = Object.values(ROLE_CODE) as RoleCode[];

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

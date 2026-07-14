export const ROLE_NAMES = [
  "data Đóng gói",
  "data Vật tư",
  "Tổ trưởng vật tư",
  "Material Control",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const PACKING_ROLE: RoleName = "data Đóng gói";
export const MATERIAL_DATA_ROLE: RoleName = "data Vật tư";
export const MATERIAL_LEAD_ROLE: RoleName = "Tổ trưởng vật tư";
export const MATERIAL_CONTROL_ROLE: RoleName = "Material Control";
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

export const USER_MANAGEMENT_ROLES: readonly RoleName[] = [
  MATERIAL_LEAD_ROLE,
  MATERIAL_CONTROL_ROLE,
];

export const resolveRoleName = (value: unknown): RoleName | null => {
  const candidate =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "role_name" in value
        ? (value as { role_name?: unknown }).role_name
        : null;

  return typeof candidate === "string" && ROLE_NAMES.includes(candidate as RoleName)
    ? (candidate as RoleName)
    : null;
};

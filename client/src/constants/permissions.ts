export const PERMISSION_CODE = {
  ADMIN_USER_READ: 'admin.user.read',
  ADMIN_USER_CREATE: 'admin.user.create',
  ADMIN_USER_UPDATE: 'admin.user.update',
  ADMIN_ROLE_READ: 'admin.role.read',
  ADMIN_ROLE_CREATE: 'admin.role.create',
  ADMIN_ROLE_UPDATE: 'admin.role.update',
  ADMIN_ROLE_ASSIGN_PERMISSION: 'admin.role.assign_permission',
  ADMIN_USER_ASSIGN_ROLE: 'admin.user.assign_role',
  MILKRUN_TRIP_READ_OWN: 'milkrun.trip.read_own',
  MILKRUN_TRIP_READ_ALL: 'milkrun.trip.read_all',
  MILKRUN_TRIP_CREATE: 'milkrun.trip.create',
  MILKRUN_TRIP_START: 'milkrun.trip.start',
  MILKRUN_TRIP_ARRIVE: 'milkrun.trip.arrive',
  MILKRUN_TRIP_COMPLETE: 'milkrun.trip.complete',
  MILKRUN_RACK_READ: 'milkrun.rack.read',
  MILKRUN_RACK_CREATE: 'milkrun.rack.create',
  MILKRUN_RACK_UPDATE: 'milkrun.rack.update',
  MILKRUN_STOCK_READ: 'milkrun.stock.read',
  MILKRUN_STOCK_ADJUST: 'milkrun.stock.adjust',
  MILKRUN_VEHICLE_READ: 'milkrun.vehicle.read',
  MILKRUN_VEHICLE_ASSIGN: 'milkrun.vehicle.assign',
  MILKRUN_DASHBOARD_READ: 'milkrun.dashboard.read',
  SUPPLY_CATALOG_READ: 'supply.catalog.read',
  SUPPLY_CATALOG_CREATE: 'supply.catalog.create',
  SUPPLY_CATALOG_UPDATE: 'supply.catalog.update',
  SUPPLY_CATALOG_DELETE: 'supply.catalog.delete',
  SUPPLY_STOCK_READ: 'supply.stock.read',
  SUPPLY_STOCK_ADJUST: 'supply.stock.adjust',
  SUPPLY_ORDER_CREATE: 'supply.order.create',
  SUPPLY_ORDER_APPROVE: 'supply.order.approve',
  SUPPLY_ORDER_ISSUE: 'supply.order.issue',
  SUPPLY_DASHBOARD_READ: 'supply.dashboard.read',
} as const;

export type PermissionCode =
  (typeof PERMISSION_CODE)[keyof typeof PERMISSION_CODE];

export type PermissionInput = PermissionCode | string;

export const hasPermissionInSet = (
  permissions: readonly string[],
  permission: PermissionInput,
  isSystemAdmin = false,
): boolean => isSystemAdmin || permissions.includes(permission);

export const hasAnyPermissionInSet = (
  permissions: readonly string[],
  requiredPermissions: readonly PermissionInput[],
  isSystemAdmin = false,
): boolean => requiredPermissions.length > 0 && (
  isSystemAdmin
  || requiredPermissions.some((permission) => permissions.includes(permission))
);

export const hasAllPermissionsInSet = (
  permissions: readonly string[],
  requiredPermissions: readonly PermissionInput[],
  isSystemAdmin = false,
): boolean => requiredPermissions.length > 0 && (
  isSystemAdmin
  || requiredPermissions.every((permission) => permissions.includes(permission))
);

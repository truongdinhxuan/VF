type QueryParameters = Record<string, unknown>;

const resourceKeys = (resource: string) => ({
  all: [resource] as const,
  lists: [resource, 'list'] as const,
  list: (query: QueryParameters) => [resource, 'list', query] as const,
  lookups: [resource, 'lookup'] as const,
  lookup: (query: QueryParameters = {}) => [resource, 'lookup', query] as const,
  details: [resource, 'detail'] as const,
  detail: (id: string) => [resource, 'detail', id] as const,
});

export const queryKeys = {
  users: resourceKeys('users'),
  roles: resourceKeys('roles'),
  permissions: resourceKeys('permissions'),
  rolePermissions: {
    all: ['role-permissions'] as const,
    detail: (roleId: string) => ['role-permissions', roleId] as const,
  },
  userRoles: {
    all: ['user-roles'] as const,
    detail: (userId: string) => ['user-roles', userId] as const,
  },
  areas: resourceKeys('areas'),
  supplyCategories: resourceKeys('supply-categories'),
  units: resourceKeys('units'),
  supplies: resourceKeys('supplies'),
  providers: resourceKeys('providers'),
  supplyProviders: {
    all: ['supply-providers'] as const,
    lists: ['supply-providers', 'list'] as const,
    list: (supplyId: string) => ['supply-providers', 'list', supplyId] as const,
  },
  storageLocations: resourceKeys('storage-locations'),
  stockBalances: resourceKeys('stock-balances'),
  stockTransactions: resourceKeys('stock-transactions'),
  orders: resourceKeys('orders'),
  orderStatuses: resourceKeys('order-statuses'),
  stockTransactionTypes: resourceKeys('stock-transaction-types'),
  adjustmentReasons: resourceKeys('adjustment-reasons'),
  orderRevisionActions: resourceKeys('order-revision-actions'),
  milkrunTrips: resourceKeys('milkrun-trips'),
  milkrunRacks: resourceKeys('milkrun-racks'),
  milkrunShops: resourceKeys('milkrun-shops'),
  milkrunTripTypes: resourceKeys('milkrun-trip-types'),
  milkrunTripStatuses: resourceKeys('milkrun-trip-statuses'),
  milkrunVehicles: resourceKeys('milkrun-vehicles'),
  milkrunStockBalances: resourceKeys('milkrun-stock-balances'),
  milkrunStockTransactions: resourceKeys('milkrun-stock-transactions'),
  milkrunStockTransactionTypes: resourceKeys('milkrun-stock-transaction-types'),
  milkrunAdjustmentReasons: resourceKeys('milkrun-adjustment-reasons'),
  milkrunDashboard: {
    all: ['milkrun-dashboard'] as const,
    detail: (query: QueryParameters = {}) => ['milkrun-dashboard', query] as const,
  },
} as const;

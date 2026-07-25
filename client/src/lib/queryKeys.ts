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
  positions: resourceKeys('positions'),
  areas: resourceKeys('areas'),
  supplyCategories: resourceKeys('supply-categories'),
  units: resourceKeys('units'),
  supplies: resourceKeys('supplies'),
  storageLocations: resourceKeys('storage-locations'),
  stockBalances: resourceKeys('stock-balances'),
  stockTransactions: resourceKeys('stock-transactions'),
  orders: resourceKeys('orders'),
} as const;

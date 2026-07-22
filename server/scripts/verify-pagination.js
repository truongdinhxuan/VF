'use strict';

require('dotenv/config');

const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { createClient } = require('@supabase/supabase-js');

const { AreasService } = require('../dist/services/areas.service');
const { OrderService } = require('../dist/services/orders.service');
const { PositionsService } = require('../dist/services/positions.service');
const { RolesService } = require('../dist/services/roles.service');
const { StockBalancesService } = require('../dist/services/stock-balances.service');
const { StockTransactionsService } = require('../dist/services/stock-transactions.service');
const { StorageLocationsService } = require('../dist/services/storage-locations.service');
const { SuppliesService } = require('../dist/services/supplies.service');
const { SupplyCategoriesService } = require('../dist/services/supply-categories.service');
const { UnitsService } = require('../dist/services/units.service');
const { UsersService } = require('../dist/services/users.service');
const { PaginationValidationError } = require('../dist/utils/pagination');

const rolesRoutes = require('../dist/routes/roles').default;
const stockBalancesRoutes = require('../dist/routes/stock-balances').default;

const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const serviceContext = { supabaseAdmin, log: { error() {}, warn() {} } };

const assertPaginatedResult = (result, expectedPage, expectedPageSize) => {
  assert.ok(Array.isArray(result.items));
  assert.equal(result.pagination.page, expectedPage);
  assert.equal(result.pagination.pageSize, expectedPageSize);
  assert.ok(Number.isInteger(result.pagination.total));
  assert.ok(Number.isInteger(result.pagination.totalPages));
  assert.equal(
    result.pagination.totalPages,
    result.pagination.total === 0
      ? 0
      : Math.ceil(result.pagination.total / expectedPageSize),
  );
  assert.equal(
    result.pagination.hasNextPage,
    result.pagination.totalPages > 0 && expectedPage < result.pagination.totalPages,
  );
  assert.equal(
    result.pagination.hasPreviousPage,
    result.pagination.totalPages > 0 && expectedPage > 1,
  );
};

const expectPaginationError = async (operation) => {
  await assert.rejects(
    operation,
    (error) => error instanceof PaginationValidationError && error.statusCode === 400,
  );
};

const dateBounds = (value) => {
  if (!value) return {};
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return {};
  return {
    dateFrom: new Date(date.getTime() - 1000).toISOString(),
    dateTo: new Date(date.getTime() + 1000).toISOString(),
  };
};

const runServiceChecks = async (descriptor) => {
  const firstPage = await descriptor.list({ page: 1, pageSize: 20 });
  assertPaginatedResult(firstPage, 1, 20);

  const one = await descriptor.list({ page: 1, pageSize: 1 });
  assertPaginatedResult(one, 1, 1);
  const hundred = await descriptor.list({ page: 1, pageSize: 100 });
  assertPaginatedResult(hundred, 1, 100);

  const largePage = Math.max(firstPage.pagination.totalPages + 2, 2);
  const beyond = await descriptor.list({ page: largePage, pageSize: 20 });
  assertPaginatedResult(beyond, largePage, 20);
  assert.deepEqual(beyond.items, []);

  if (one.pagination.total > 1) {
    const second = await descriptor.list({ page: 2, pageSize: 1 });
    assertPaginatedResult(second, 2, 1);
    assert.notEqual(one.items[0]?.id, second.items[0]?.id);
  }

  const stableAgain = await descriptor.list({ page: 1, pageSize: 20 });
  assert.deepEqual(
    firstPage.items.map((item) => item.id),
    stableAgain.items.map((item) => item.id),
  );

  const positiveTerm = descriptor.searchTerm(firstPage.items[0]);
  let positiveSearch = 'skipped-empty-table';
  if (positiveTerm) {
    const result = await descriptor.list({ page: 1, pageSize: 20, search: positiveTerm });
    assertPaginatedResult(result, 1, 20);
    assert.ok(result.pagination.total > 0);
    positiveSearch = 'passed';
  }

  const missing = await descriptor.list({
    page: 1,
    pageSize: 20,
    search: `__pagination_missing_${Date.now()}__`,
  });
  assertPaginatedResult(missing, 1, 20);
  assert.equal(missing.pagination.total, 0);
  assert.deepEqual(missing.items, []);

  const filter = descriptor.filter(firstPage.items[0]);
  let filterChecks = 'skipped-empty-table';
  if (Object.keys(filter).length > 0) {
    const filtered = await descriptor.list({ page: 1, pageSize: 100, ...filter });
    assertPaginatedResult(filtered, 1, 100);
    assert.ok(filtered.pagination.total >= filtered.items.length);
    filterChecks = 'passed';
  }

  for (const sortOrder of ['asc', 'desc']) {
    const sorted = await descriptor.list({
      page: 1,
      pageSize: 20,
      sortBy: descriptor.sortBy,
      sortOrder,
    });
    assertPaginatedResult(sorted, 1, 20);
  }

  await expectPaginationError(() => descriptor.list({ page: 0 }));
  await expectPaginationError(() => descriptor.list({ page: -1 }));
  await expectPaginationError(() => descriptor.list({ pageSize: 101 }));
  await expectPaginationError(() => descriptor.list({ sortBy: '__invalid__' }));
  await expectPaginationError(() => descriptor.list({ sortOrder: '__invalid__' }));

  if (descriptor.softDeleteCheck) descriptor.softDeleteCheck(hundred.items);

  return {
    endpoint: descriptor.endpoint,
    total: firstPage.pagination.total,
    positiveSearch,
    filters: filterChecks,
  };
};

const relation = (value) => Array.isArray(value) ? value[0] : value;

const getActors = async () => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, area_id, is_active, is_verified, role:roles!users_role_id_fkey(role_name)')
    .eq('is_active', true)
    .eq('is_verified', true);
  if (error) throw error;

  const actors = new Map();
  for (const user of data ?? []) {
    const roleName = relation(user.role)?.role_name;
    if (roleName) actors.set(roleName, { id: user.id, areaId: user.area_id, role: roleName });
  }
  return actors;
};

const assertHttpContract = (payload) => {
  assert.ok(payload && typeof payload === 'object');
  assert.ok(Array.isArray(payload.data));
  assert.deepEqual(Object.keys(payload.pagination).sort(), [
    'hasNextPage',
    'hasPreviousPage',
    'page',
    'pageSize',
    'total',
    'totalPages',
  ].sort());
};

const runPermissionAndHttpChecks = async (actors) => {
  const admin = actors.get('Admin');
  const packing = actors.get('data Đóng gói');
  assert.ok(admin, 'An active and verified Admin is required');
  assert.ok(packing, 'An active and verified packing user is required');

  const tokens = new Map([
    ['admin-test-token', admin],
    ['packing-test-token', packing],
  ]);
  const authClient = {
    auth: {
      getUser: async (token) => {
        const actor = tokens.get(token);
        return actor
          ? { data: { user: { id: actor.id } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') };
      },
    },
  };

  const app = Fastify({ logger: false });
  app.decorate('supabase', authClient);
  app.decorate('supabaseAdmin', supabaseAdmin);
  await app.register(rolesRoutes, { prefix: '/roles' });
  await app.register(stockBalancesRoutes, { prefix: '/stock-balances' });
  await app.ready();

  try {
    const roleResponse = await app.inject({
      method: 'GET',
      url: '/roles?page=1&pageSize=20',
      headers: { authorization: 'Bearer admin-test-token' },
    });
    assert.equal(roleResponse.statusCode, 200);
    assertHttpContract(roleResponse.json());

    const invalidPage = await app.inject({
      method: 'GET',
      url: '/roles?page=0',
      headers: { authorization: 'Bearer admin-test-token' },
    });
    assert.equal(invalidPage.statusCode, 400);

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/roles?page=1&pageSize=20',
    });
    assert.equal(unauthenticated.statusCode, 401);

    const deniedStock = await app.inject({
      method: 'GET',
      url: '/stock-balances?page=1&pageSize=20',
      headers: { authorization: 'Bearer packing-test-token' },
    });
    assert.equal(deniedStock.statusCode, 403);

    const allowedStock = await app.inject({
      method: 'GET',
      url: '/stock-balances?page=1&pageSize=20',
      headers: { authorization: 'Bearer admin-test-token' },
    });
    assert.equal(allowedStock.statusCode, 200);
    assertHttpContract(allowedStock.json());
  } finally {
    await app.close();
  }
};

const main = async () => {
  const actors = await getActors();
  const admin = actors.get('Admin');
  assert.ok(admin, 'An active and verified Admin is required');

  const descriptors = [
    {
      endpoint: '/users',
      list: (query) => new UsersService(serviceContext).list(query),
      searchTerm: (item) => item?.email?.split('@')[0] ?? null,
      filter: (item) => item ? {
        roleId: item.role_id,
        ...(item.position_id ? { positionId: item.position_id } : {}),
        areaId: item.area_id,
        isActive: item.is_active,
      } : {},
      sortBy: 'email',
    },
    {
      endpoint: '/roles',
      list: (query) => new RolesService(serviceContext).list(query),
      searchTerm: (item) => item?.role_name ?? null,
      filter: () => ({}),
      sortBy: 'role_name',
    },
    {
      endpoint: '/positions',
      list: (query) => new PositionsService(serviceContext).list(query),
      searchTerm: (item) => item?.position_name ?? null,
      filter: () => ({}),
      sortBy: 'position_name',
    },
    {
      endpoint: '/areas',
      list: (query) => new AreasService(serviceContext).list(query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? { isActive: item.is_active } : {},
      sortBy: 'code',
      softDeleteCheck: (items) => assert.ok(items.every((item) => item.is_active)),
    },
    {
      endpoint: '/supply-categories',
      list: (query) => new SupplyCategoriesService(serviceContext).list(query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? { isActive: item.is_active } : {},
      sortBy: 'code',
      softDeleteCheck: (items) => assert.ok(items.every((item) => !item.is_deleted)),
    },
    {
      endpoint: '/units',
      list: (query) => new UnitsService(serviceContext).list(query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? { isActive: item.is_active } : {},
      sortBy: 'code',
      softDeleteCheck: (items) => assert.ok(items.every((item) => !item.is_deleted)),
    },
    {
      endpoint: '/supplies',
      list: (query) => new SuppliesService(serviceContext).list('Admin', query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? {
        categoryId: item.category_id,
        unitId: item.unit_id,
        isActive: item.is_active,
        isDeleted: item.is_deleted,
      } : {},
      sortBy: 'code',
      softDeleteCheck: (items) => assert.ok(items.every((item) => !item.is_deleted)),
    },
    {
      endpoint: '/storage-locations',
      list: (query) => new StorageLocationsService(serviceContext).list(query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? { areaId: item.area_id, isActive: item.is_active } : {},
      sortBy: 'code',
      softDeleteCheck: (items) => assert.ok(items.every((item) => item.is_active)),
    },
    {
      endpoint: '/stock-balances',
      list: (query) => new StockBalancesService(serviceContext).list(query),
      searchTerm: (item) => relation(item?.supply)?.code ?? null,
      filter: (item) => item ? {
        supplyId: item.supply_id,
        areaId: item.area_id,
        storageLocationId: item.storage_location_id,
      } : {},
      sortBy: 'quantity',
    },
    {
      endpoint: '/stock-transactions',
      list: (query) => new StockTransactionsService(serviceContext).list(query),
      searchTerm: (item) => item?.reason ?? relation(item?.supply)?.code ?? null,
      filter: (item) => item ? {
        type: item.type,
        supplyId: item.supply_id,
        areaId: item.area_id,
        storageLocationId: item.storage_location_id,
        createdBy: item.created_by,
        ...dateBounds(item.created_at),
      } : {},
      sortBy: 'created_at',
    },
    {
      endpoint: '/orders',
      list: (query) => new OrderService(serviceContext).list(admin, query),
      searchTerm: (item) => item?.code ?? null,
      filter: (item) => item ? {
        status: item.status,
        createdBy: item.requested_by,
        areaId: item.from_area_id,
        ...dateBounds(item.created_at),
      } : {},
      sortBy: 'created_at',
    },
  ];

  const results = [];
  for (const descriptor of descriptors) {
    results.push(await runServiceChecks(descriptor));
  }
  await runPermissionAndHttpChecks(actors);

  console.log(JSON.stringify({
    ok: true,
    endpoints: results,
    httpContract: 'passed',
    permission: 'passed',
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  PaginationValidationError,
  createPaginationMetadata,
  parsePagination,
  resolvePaginatedQueryResult,
  toPaginatedResponse,
} from '../../src/utils/pagination';

describe('pagination helper', () => {
  const whitelist = ['id', 'code', 'created_at'] as const;

  it('applies defaults and computes the inclusive Supabase range', () => {
    assert.deepEqual(parsePagination({}, {
      allowedSortBy: whitelist,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    }), {
      page: 1,
      pageSize: 20,
      search: null,
      sortBy: 'created_at',
      sortOrder: 'desc',
      from: 0,
      to: 19,
    });

    const parsed = parsePagination(
      { page: '3', pageSize: '50', search: '  VT31  ', sortBy: 'code', sortOrder: 'asc' },
      {
        allowedSortBy: whitelist,
        defaultSortBy: 'created_at',
        defaultSortOrder: 'desc',
      },
    );
    assert.equal(parsed.from, 100);
    assert.equal(parsed.to, 149);
    assert.equal(parsed.search, 'VT31');
    assert.equal(parsed.sortBy, 'code');
    assert.equal(parsed.sortOrder, 'asc');
  });

  it('rejects invalid pages, page sizes, sorting and unsafe search syntax', () => {
    for (const query of [
      { page: 0 },
      { pageSize: 101 },
      { sortBy: 'unknown' },
      { sortOrder: 'sideways' },
      { search: 'code,name' },
    ]) {
      assert.throws(
        () => parsePagination(query, {
          allowedSortBy: whitelist,
          defaultSortBy: 'created_at',
          defaultSortOrder: 'desc',
        }),
        (error: unknown) =>
          error instanceof PaginationValidationError && error.statusCode === 400,
      );
    }
  });

  it('creates stable metadata and permits pages beyond the last page', () => {
    assert.deepEqual(createPaginationMetadata(5, 20, 42), {
      page: 5,
      pageSize: 20,
      total: 42,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    assert.deepEqual(toPaginatedResponse({
      items: [],
      pagination: createPaginationMetadata(5, 20, 42),
    }), {
      data: [],
      pagination: {
        page: 5,
        pageSize: 20,
        total: 42,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });

  it('converts PostgREST out-of-range responses into an empty page', () => {
    const parsed = parsePagination({ page: 5, pageSize: 20 }, {
      allowedSortBy: whitelist,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });
    assert.deepEqual(resolvePaginatedQueryResult({
      data: null,
      count: null,
      error: {
        code: 'PGRST103',
        details: 'An offset of 80 was requested, but there are only 42 rows.',
      },
    }, parsed), {
      items: [],
      pagination: createPaginationMetadata(5, 20, 42),
    });
    assert.equal(resolvePaginatedQueryResult({
      data: null,
      count: null,
      error: { code: 'OTHER', details: 'database failure' },
    }, parsed), null);
  });
});

describe('paginated list services', () => {
  const serviceFiles = [
    'users.service.ts',
    'roles.service.ts',
    'areas.service.ts',
    'supply-categories.service.ts',
    'units.service.ts',
    'supplies.service.ts',
    'storage-locations.service.ts',
    'stock-balances.service.ts',
    'stock-transactions.service.ts',
    'orders.service.ts',
  ];

  for (const serviceFile of serviceFiles) {
    it(`${serviceFile} counts, sorts and ranges at the database`, () => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/services', serviceFile),
        'utf8',
      );
      assert.match(source, /count:\s*'exact'/);
      assert.match(source, /\.order\((?:pagination\.sortBy|sortBy)/);
      assert.match(source, /\.order\('id'/);
      assert.match(source, /\.range\(pagination\.from, pagination\.to\)/);
    });
  }
});

describe('stock transaction immutability', () => {
  it('does not register PATCH or DELETE transaction routes', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/routes/stock-transactions/index.ts'),
      'utf8',
    );
    assert.doesNotMatch(route, /fastify\.(patch|delete)\(/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/202608110006_provider_security_hardening.sql',
  ),
  'utf8',
);

describe('Provider final security hardening', () => {
  it('closes direct Supabase access to every Provider-scoped table', () => {
    for (const table of [
      'providers',
      'supply_providers',
      'stock_balances',
      'stock_transactions',
      'order_items',
    ]) {
      assert.match(
        migration,
        new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      );
      assert.match(
        migration,
        new RegExp(
          `revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated`,
          'i',
        ),
      );
      assert.match(
        migration,
        new RegExp(`grant all on table public\\.${table} to service_role`, 'i'),
      );
    }
  });

  it('protects UNKNOW by code without a hard-coded Provider UUID', () => {
    assert.match(
      migration,
      /create or replace function public\.protect_unknown_provider\(\)/i,
    );
    assert.match(migration, /old\.code <> 'UNKNOW'/i);
    assert.match(migration, /Provider UNKNOW cannot be deleted/i);
    assert.match(migration, /Provider UNKNOW code cannot be changed/i);
    assert.match(migration, /Provider UNKNOW cannot be deactivated/i);
    assert.doesNotMatch(
      migration,
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
  });

  it('verifies Provider backfill and active Supply relationships before commit', () => {
    assert.match(migration, /Expected exactly one active Provider UNKNOW/i);
    assert.match(migration, /At least one Supply has no active Provider relation/i);
    assert.match(migration, /Provider backfill is incomplete/i);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/20260823165527_supply_stack_discrepancy_confirmation.sql',
);
const serviceRoleGrantMigration = read(
  'supabase/migrations/20260823165524_service_role_authorization_read_grants.sql',
);
const ordersRoutes = read('src/routes/orders/index.ts');
const ordersService = read('src/services/orders.service.ts');
const balanceRoutes = read('src/routes/stock-balances/index.ts');
const balanceService = read('src/services/stock-balances.service.ts');
const discrepancyRoutes = read('src/routes/inventory-discrepancies/index.ts');
const discrepancyService = read('src/services/inventory-discrepancies.service.ts');

describe('Supply stack Phase 5 discrepancy confirmation', () => {
  it('seeds semantic permissions and the master transaction type without a database enum', () => {
    assert.match(migration, /supply\.order\.confirm_allocation/);
    assert.match(migration, /supply\.discrepancy\.resolve/);
    assert.match(migration, /DISCREPANCY_CORRECTION/);
    assert.match(migration, /DATA_MATERIAL/);
    assert.doesNotMatch(migration, /create\s+type[\s\S]*enum/i);
  });

  it('keeps correction, discrepancy and full-only reallocation in one locked RPC', () => {
    assert.match(migration, /create or replace function public\.confirm_stack_allocation_actual/i);
    assert.match(migration, /for update of allocation/i);
    assert.match(migration, /for update of orders/i);
    assert.match(migration, /for update of balance/i);
    assert.match(migration, /insert into public\.inventory_discrepancies/i);
    assert.match(migration, /insert into public\.stock_transactions/i);
    assert.match(migration, /v_available_alternative < v_difference/i);
    assert.match(migration, /v_reallocation_status := 'INSUFFICIENT'/i);
    assert.doesNotMatch(migration, /update public\.stock_transactions|delete from public\.stock_transactions/i);
  });

  it('exposes confirmation through permission-protected Order API without issuing stock', () => {
    assert.match(ordersRoutes, /allocations\/:allocationId\/confirm/);
    assert.match(ordersRoutes, /SUPPLY_ORDER_CONFIRM_ALLOCATION/);
    assert.match(ordersService, /confirm_stack_allocation_actual/);
    assert.doesNotMatch(
      ordersService.match(/async confirmAllocation[\s\S]*?\n  }/i)?.[0] ?? '',
      /issue_order|SUPPLY_ORDER_ISSUE/,
    );
  });

  it('derives warning state and supports server-side warning filtering plus history', () => {
    assert.match(migration, /function public\.has_open_discrepancy/i);
    assert.match(balanceService, /has_open_discrepancy/);
    assert.match(balanceService, /request\.eq\('has_open_discrepancy', true\)/);
    assert.match(balanceService, /request\.eq\('has_open_discrepancy', false\)/);
    assert.match(balanceRoutes, /:id\/discrepancies/);
  });

  it('resolves an OPEN discrepancy without stock or ledger mutation', () => {
    assert.match(discrepancyRoutes, /:id\/resolve/);
    assert.match(discrepancyRoutes, /SUPPLY_DISCREPANCY_RESOLVE/);
    assert.match(discrepancyService, /resolve_inventory_discrepancy/);
    const resolveRpc = migration.match(
      /create or replace function public\.resolve_inventory_discrepancy[\s\S]*?\nend;\n\$\$;/i,
    )?.[0] ?? '';
    assert.match(resolveRpc, /RESOLUTION_NOTE_REQUIRED/);
    assert.match(resolveRpc, /DISCREPANCY_ALREADY_RESOLVED/);
    assert.doesNotMatch(resolveRpc, /stock_balances|stock_transactions/);
  });

  it('keeps mutation RPC execution backend-only', () => {
    for (const signature of [
      'confirm_stack_allocation_actual',
      'resolve_inventory_discrepancy',
    ]) {
      assert.match(migration, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated`, 'i'));
      assert.match(migration, new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to service_role`, 'i'));
    }
  });

  it('grants backend-only reads required by current PostgREST authorization and embeds', () => {
    for (const table of [
      'users',
      'roles',
      'user_roles',
      'permissions',
      'role_permissions',
      'orders',
      'order_items',
      'order_item_allocations',
      'inventory_discrepancies',
      'stock_balances',
      'stock_transactions',
    ]) {
      assert.match(
        serviceRoleGrantMigration,
        new RegExp(`grant select on table public\\.${table} to service_role`, 'i'),
      );
    }
    assert.doesNotMatch(serviceRoleGrantMigration, /to anon|to authenticated/i);
  });
});

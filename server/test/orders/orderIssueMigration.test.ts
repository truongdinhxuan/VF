import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/202607290001_lookup_master_data_foundation.sql',
  ),
  'utf8',
);
const orderService = readFileSync(
  resolve(process.cwd(), 'src/services/orders.service.ts'),
  'utf8',
);
const stackIssueMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260824031430_supply_stack_issue_finalization.sql',
  ),
  'utf8',
);
const orderRoutes = readFileSync(
  resolve(process.cwd(), 'src/routes/orders/index.ts'),
  'utf8',
);
const orderAccess = readFileSync(
  resolve(process.cwd(), 'src/domain/order-access.ts'),
  'utf8',
);

describe('atomic order issue migration', () => {
  it('locks order, item and stock rows before issuing', () => {
    assert.ok((migration.match(/for update/gi) ?? []).length >= 3);
  });

  it('updates balance and writes immutable audit transactions in one function', () => {
    assert.match(migration, /create or replace function public\.issue_order/i);
    assert.match(migration, /update public\.stock_balances/i);
    assert.match(migration, /insert into public\.stock_transactions/i);
    assert.match(migration, /update public\.order_items/i);
    assert.match(migration, /update public\.orders/i);
  });

  it('contains both approved-quantity and stock-quantity guards', () => {
    assert.match(migration, /Cannot issue more than quantity_approved/i);
    assert.match(migration, /Insufficient stock/i);
  });

  it('only issues from an active location in the order source area', () => {
    assert.match(migration, /l\.area_id\s*=\s*v_order\.from_area_id/i);
    assert.match(migration, /l\.is_active\s*=\s*true/i);
    assert.match(migration, /outside the source area/i);
  });

  it('deducts and records stock against the order source area', () => {
    assert.match(
      migration,
      /from public\.stock_balances[\s\S]*area_id\s*=\s*v_order\.from_area_id/i,
    );
    assert.match(
      migration,
      /insert into public\.stock_transactions[\s\S]*v_order\.from_area_id/i,
    );
  });

  it('is executable only by the service role', () => {
    assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute[\s\S]*to service_role/i);
  });

  it('keeps direct stock mutation out of create/submit/approve service code', () => {
    assert.doesNotMatch(
      orderService,
      /\.from\(['"]stock_balances['"]\)[\s\S]{0,500}\.(?:insert|update|delete|upsert)\(/,
    );
    assert.doesNotMatch(
      orderService,
      /\.from\(['"]stock_transactions['"]\)[\s\S]{0,120}\.(?:insert|update|delete)\(/,
    );
    assert.equal((orderService.match(/\.rpc\(['"]issue_order['"]/g) ?? []).length, 1);
  });
});

describe('Supply stack Phase 6 issue finalization', () => {
  it('extends the single authoritative issue_order RPC', () => {
    assert.match(
      stackIssueMigration,
      /create or replace function public\.issue_order\(\s*p_order_id uuid,\s*p_actor_id uuid,\s*p_items jsonb/,
    );
    assert.equal((orderService.match(/\.rpc\(['"]issue_order['"]/g) ?? []).length, 1);
    assert.doesNotMatch(stackIssueMigration, /create\s+function\s+public\.[a-z_]*stack[a-z_]*issue/i);
  });

  it('resolves KIEN_SAT_TC in PostgreSQL and never treats KIEN_SAT_SPECIAL as Stack', () => {
    assert.match(stackIssueMigration, /v_order_item\.category_code = 'KIEN_SAT_TC'/);
    assert.doesNotMatch(stackIssueMigration, /v_order_item\.category_code\s*=\s*'KIEN_SAT_SPECIAL'/);
  });

  it('uses confirmed actual allocations as the Stack source of truth', () => {
    assert.match(stackIssueMigration, /allocation\.actual_stack_quantity is null/);
    assert.match(stackIssueMigration, /sum\(allocation\.actual_stack_quantity\)/);
    assert.match(stackIssueMigration, /STACK_ISSUE_ALLOCATION_INCOMPLETE/);
    assert.match(stackIssueMigration, /STACK_APPROVAL_NOT_COMPATIBLE/);
    assert.match(stackIssueMigration, /STACK_PARTIAL_ISSUE_NOT_SUPPORTED/);
  });

  it('locks deterministically and writes official immutable ISSUE transactions', () => {
    assert.match(stackIssueMigration, /order by balance\.id\s*for update/);
    assert.match(stackIssueMigration, /insert into public\.stock_transactions/);
    assert.match(stackIssueMigration, /transaction_type\.code = 'ISSUE'/);
    assert.match(stackIssueMigration, /actual_stack_quantity > 0/);
  });

  it('preserves service-role-only execution and structured semantic errors', () => {
    assert.match(
      stackIssueMigration,
      /grant select on table public\.adjustment_reasons to service_role/,
    );
    assert.match(stackIssueMigration, /revoke all[\s\S]*from public, anon, authenticated/i);
    assert.match(stackIssueMigration, /grant execute[\s\S]*to service_role/i);
    for (const code of [
      'STACK_ALLOCATIONS_NOT_CONFIRMED',
      'STACK_ISSUE_ALLOCATION_INCOMPLETE',
      'STACK_APPROVAL_NOT_COMPATIBLE',
      'STACK_PARTIAL_ISSUE_NOT_SUPPORTED',
      'STACK_ISSUE_STOCK_CONFLICT',
      'ORDER_NOT_ISSUABLE',
      'ORDER_ALREADY_ISSUED',
    ]) {
      assert.match(orderService, new RegExp(code));
    }
  });

  it('lets an issue-only custom role read the Order it must issue', () => {
    const readRequirement = orderRoutes.match(
      /const orderReadPermission =[\s\S]*?const orderReviewPermission/,
    )?.[0] ?? '';
    assert.match(readRequirement, /ORDER_READ_PERMISSIONS/);
    assert.match(orderAccess, /SUPPLY_ORDER_ISSUE/);
    assert.doesNotMatch(readRequirement, /role\s*===|DATA_MATERIAL/);
  });
});

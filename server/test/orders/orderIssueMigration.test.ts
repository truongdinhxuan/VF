import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607140002_order_issue_rpc.sql'),
  'utf8',
);
const orderService = readFileSync(
  resolve(process.cwd(), 'src/services/order.service.ts'),
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

  it('is executable only by the service role', () => {
    assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute[\s\S]*to service_role/i);
  });

  it('keeps direct stock mutation out of create/submit/approve service code', () => {
    assert.doesNotMatch(orderService, /\.from\(['"]stock_balances['"]\)/);
    assert.doesNotMatch(
      orderService,
      /\.from\(['"]stock_transactions['"]\)[\s\S]{0,120}\.(?:insert|update|delete)\(/,
    );
    assert.equal((orderService.match(/\.rpc\(['"]issue_order['"]/g) ?? []).length, 1);
  });
});

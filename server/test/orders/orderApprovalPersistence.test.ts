import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const orderService = readFileSync(
  resolve(process.cwd(), 'src/services/orders.service.ts'),
  'utf8',
);
const lookupMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/202607290001_lookup_master_data_foundation.sql',
  ),
  'utf8',
);

describe('order approval item persistence', () => {
  it('includes every required OrderItem column in approval upserts', () => {
    const approvalPayload = orderService.match(
      /const updates = order\.order_items\.map\([\s\S]*?\n\s*\}\);/,
    )?.[0];

    assert.ok(approvalPayload, 'approval update payload must exist');
    for (const field of [
      'id',
      'order_id',
      'supply_id',
      'provider_id',
      'unit_id',
      'quantity_requested',
      'quantity_approved',
    ]) {
      assert.match(
        approvalPayload,
        new RegExp(`\\b${field}:`),
        `${field} must be included in the approval upsert`,
      );
    }
  });

  it('performs approval and actor audit in one database RPC', () => {
    assert.match(
      orderService,
      /\.rpc\('review_order'/,
    );
    assert.match(orderService, /p_actor_id:\s*actor\.id/);
    assert.match(
      lookupMigration,
      /insert into public\.order_revisions[\s\S]*created_by[\s\S]*p_actor_id/i,
    );
    assert.match(
      lookupMigration,
      /p_action_code not in \('APPROVE', 'REJECT'\)/i,
    );
  });
});

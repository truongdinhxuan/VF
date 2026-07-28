import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const orderService = readFileSync(
  resolve(process.cwd(), 'src/services/orders.service.ts'),
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

  it('still performs one batch upsert keyed by OrderItem id', () => {
    assert.match(
      orderService,
      /\.from\('order_items'\)\s*\.upsert\(updates,\s*\{\s*onConflict:\s*'id'\s*\}\)/,
    );
  });
});

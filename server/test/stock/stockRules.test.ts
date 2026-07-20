import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertPositiveStockQuantity,
  assertStockAdjustmentType,
  normalizeStockReason,
} from '../../src/domain/stockRules';

describe('stock adjustment rules', () => {
  it('accepts only non-order adjustment/import/export types', () => {
    for (const type of ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'IMPORT', 'EXPORT']) {
      assert.equal(assertStockAdjustmentType(type), type);
    }
    for (const type of ['ISSUE', 'RECEIVE', 'TRANSFER_IN', 'TRANSFER_OUT']) {
      assert.throws(() => assertStockAdjustmentType(type), /supported stock adjustment type/);
    }
  });

  it('requires a finite positive quantity', () => {
    assert.equal(assertPositiveStockQuantity(2.5), 2.5);
    assert.throws(() => assertPositiveStockQuantity(0), /greater than 0/);
    assert.throws(() => assertPositiveStockQuantity(-1), /greater than 0/);
    assert.throws(() => assertPositiveStockQuantity(Number.NaN), /greater than 0/);
  });

  it('requires and normalizes the external adjustment reason', () => {
    assert.equal(normalizeStockReason('  cycle count  '), 'cycle count');
    assert.throws(() => normalizeStockReason('   '), /reason is required/);
  });
});

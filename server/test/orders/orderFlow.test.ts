import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeRoleCode,
  ROLE_CODES,
  type OrderStatus,
} from '../../src/domain/enums';
import {
  assertApprovedQuantity,
  assertCancelReason,
  assertIssueWithinApproved,
  assertOrderActionAllowed,
  assertRejectedReason,
  assertStockAvailable,
  calculateStockAvailability,
  orderActionAffectsStock,
} from '../../src/domain/orderRules';
import {
  canApproveOrder,
  canCreateOrder,
  canIssueOrder,
  canMutateStock,
  canViewStock,
  USER_MANAGER_ROLES,
} from '../../src/domain/permissions';

describe('order state flow', () => {
  it('supports DRAFT -> PENDING -> APPROVED -> PARTIAL_ISSUED -> ISSUED -> RECEIVED -> COMPLETED', () => {
    let status: OrderStatus = 'DRAFT';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'submit'));
    status = 'PENDING';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'approve'));
    status = 'APPROVED';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'issue'));
    status = 'PARTIAL_ISSUED';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'issue'));
    status = 'ISSUED';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'receive'));
    status = 'RECEIVED';
    assert.doesNotThrow(() => assertOrderActionAllowed(status, 'complete'));
    status = 'COMPLETED';
    assert.throws(() => assertOrderActionAllowed(status, 'edit'));
  });

  it('does not allow editing OrderItems after issue/receive/complete', () => {
    for (const status of ['ISSUED', 'RECEIVED', 'COMPLETED'] as const) {
      assert.throws(() => assertOrderActionAllowed(status, 'edit'));
    }
  });

  it('marks only issue as an order action with stock impact', () => {
    assert.equal(orderActionAffectsStock('edit'), false);
    assert.equal(orderActionAffectsStock('submit'), false);
    assert.equal(orderActionAffectsStock('approve'), false);
    assert.equal(orderActionAffectsStock('reject'), false);
    assert.equal(orderActionAffectsStock('receive'), false);
    assert.equal(orderActionAffectsStock('complete'), false);
    assert.equal(orderActionAffectsStock('cancel'), false);
    assert.equal(orderActionAffectsStock('issue'), true);
  });
});

describe('order quantity rules', () => {
  it('rejects quantity_approved above quantity_requested', () => {
    assert.throws(() => assertApprovedQuantity(0, 10), /greater than 0/);
    assert.throws(() => assertApprovedQuantity(11, 10), /quantity_approved/);
    assert.equal(assertApprovedQuantity(10, 10), 10);
  });

  it('reports current stock shortages without changing order quantities', () => {
    assert.deepEqual(calculateStockAvailability(100, 50), {
      available_quantity: 50,
      shortage_quantity: 50,
      has_stock_shortage: true,
    });
    assert.deepEqual(calculateStockAvailability(100, 120), {
      available_quantity: 120,
      shortage_quantity: 0,
      has_stock_shortage: false,
    });
  });

  it('rejects issue above quantity_approved including previous issues', () => {
    assert.doesNotThrow(() => assertIssueWithinApproved(4, 10, 6));
    assert.throws(() => assertIssueWithinApproved(4, 10, 7), /quantity_approved/);
  });

  it('rejects issue above the selected StockBalances quantity', () => {
    assert.doesNotThrow(() => assertStockAvailable(10, 10));
    assert.throws(() => assertStockAvailable(9, 10), /StockBalances/);
  });
});

describe('order reason and role rules', () => {
  it('requires rejected_reason', () => {
    assert.throws(() => assertRejectedReason('  '), /rejected_reason/);
    assert.equal(assertRejectedReason('not available'), 'not available');
  });

  it('requires cancel_reason for PENDING but not DRAFT', () => {
    assert.equal(assertCancelReason('DRAFT', undefined), null);
    assert.throws(() => assertCancelReason('PENDING', ''), /cancel_reason/);
    assert.equal(assertCancelReason('PENDING', 'changed plan'), 'changed plan');
  });

  it('uses the five role codes and grants Admin all operational actions', () => {
    assert.deepEqual(ROLE_CODES, [
      'ADMIN',
      'DATA_PACKING',
      'DATA_MATERIAL',
      'MATERIAL_LEADER',
      'MATERIAL_CONTROL',
    ]);
    assert.equal(normalizeRoleCode('ADMIN'), 'ADMIN');
    assert.equal(normalizeRoleCode('admin'), null);
    assert.deepEqual(USER_MANAGER_ROLES, ['ADMIN']);
    assert.equal(canCreateOrder('DATA_PACKING'), true);
    assert.equal(canApproveOrder('DATA_MATERIAL'), true);
    assert.equal(canApproveOrder('MATERIAL_LEADER'), true);
    assert.equal(canApproveOrder('MATERIAL_CONTROL'), true);
    assert.equal(canApproveOrder('ADMIN'), true);
    assert.equal(canIssueOrder('DATA_MATERIAL'), true);
    assert.equal(canIssueOrder('MATERIAL_LEADER'), true);
    assert.equal(canIssueOrder('MATERIAL_CONTROL'), true);
    assert.equal(canIssueOrder('DATA_PACKING'), false);
    assert.equal(canIssueOrder('ADMIN'), true);
    assert.equal(canViewStock('MATERIAL_CONTROL'), true);
    assert.equal(canViewStock('ADMIN'), true);
    assert.equal(canMutateStock('MATERIAL_CONTROL'), true);
    assert.equal(canMutateStock('ADMIN'), true);
  });
});

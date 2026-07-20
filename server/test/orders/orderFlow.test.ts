import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeRoleName, ROLE_NAMES, type OrderStatus } from '../../src/domain/enums';
import {
  assertApprovedQuantity,
  assertCancelReason,
  assertIssueWithinApproved,
  assertOrderActionAllowed,
  assertRejectedReason,
  assertStockAvailable,
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
    assert.throws(() => assertApprovedQuantity(11, 10), /quantity_approved/);
    assert.equal(assertApprovedQuantity(10, 10), 10);
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

  it('uses the five configured roles without granting Admin operational actions', () => {
    assert.deepEqual(ROLE_NAMES, [
      'data Đóng gói',
      'data Vật tư',
      'Tổ trưởng vật tư',
      'Material Control',
      'Admin',
    ]);
    assert.equal(normalizeRoleName('Admin'), 'Admin');
    assert.equal(normalizeRoleName('admin'), null);
    assert.deepEqual(USER_MANAGER_ROLES, ['Admin']);
    assert.equal(canCreateOrder('data Đóng gói'), true);
    assert.equal(canApproveOrder('data Vật tư'), true);
    assert.equal(canApproveOrder('Tổ trưởng vật tư'), true);
    assert.equal(canApproveOrder('Material Control'), true);
    assert.equal(canApproveOrder('Admin'), false);
    assert.equal(canIssueOrder('data Vật tư'), true);
    assert.equal(canIssueOrder('Tổ trưởng vật tư'), true);
    assert.equal(canIssueOrder('Material Control'), false);
    assert.equal(canIssueOrder('data Đóng gói'), false);
    assert.equal(canIssueOrder('Admin'), false);
    assert.equal(canViewStock('Material Control'), true);
    assert.equal(canViewStock('Admin'), true);
    assert.equal(canMutateStock('Material Control'), false);
    assert.equal(canMutateStock('Admin'), false);
  });
});

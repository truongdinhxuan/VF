import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const orderService = readFileSync(
  resolve(process.cwd(), 'src/services/orders.service.ts'),
  'utf8',
);

describe('order stock availability response', () => {
  it('loads balances once for all order supplies in the source area', () => {
    assert.equal(
      (orderService.match(/\.from\(['"]stock_balances['"]\)/g) ?? []).length,
      1,
    );
    assert.match(orderService, /\.eq\('area_id', order\.from_area_id\)/);
    assert.match(orderService, /\.in\('supply_id', supplyIds\)/);
    assert.match(orderService, /provider_id/);
    assert.match(orderService, /storage_location\.is_active/);
  });

  it('returns derived warning fields without storing them in OrderItems', () => {
    assert.match(orderService, /calculateStockAvailability/);
    assert.match(orderService, /availableBySupplyProvider\.get\(/);
    assert.match(orderService, /item\.supply_id.*item\.provider_id/s);
    assert.doesNotMatch(
      orderService,
      /\.from\(['"]order_items['"]\)[\s\S]{0,300}(?:available_quantity|shortage_quantity|has_stock_shortage)/,
    );
  });
});

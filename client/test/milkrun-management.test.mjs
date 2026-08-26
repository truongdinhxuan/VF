import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Milkrun management UI contract', () => {
  it('replaces every Milkrun management placeholder with a real page', () => {
    const routes = read('src/routes/workspace.routes.tsx');
    for (const page of [
      'MilkrunStockBalancesPage',
      'MilkrunStockTransactionsPage',
      'MilkrunStockAdjustmentPage',
      'MilkrunRacksPage',
      'MilkrunShopsPage',
      'MilkrunVehiclesPage',
    ]) assert.match(routes, new RegExp(`<${page}`));
    assert.doesNotMatch(routes, /path: 'milkrun\/stock'[\s\S]{0,180}WorkspacePlaceholderPage/);
  });

  it('uses dedicated permission codes for every implemented Milkrun catalog', () => {
    const routes = read('src/routes/workspace.routes.tsx');
    const navigation = read('src/constants/workspaceNavigation.ts');
    const tripCatalogPage = read('src/pages/milkrun/TripCatalogPage.tsx');
    const shopsPage = read('src/pages/milkrun/ShopsPage.tsx');
    const masterApi = read('src/api/milkrun-master-data.service.ts');
    assert.match(routes, /MILKRUN_STOCK_READ/);
    assert.match(routes, /MILKRUN_STOCK_ADJUST/);
    assert.match(routes, /MILKRUN_RACK_READ/);
    assert.match(routes, /MILKRUN_SHOP_READ/);
    assert.match(navigation, /MILKRUN_SHOP_READ/);
    assert.match(shopsPage, /MILKRUN_SHOP_CREATE/);
    assert.match(shopsPage, /MILKRUN_SHOP_UPDATE/);
    assert.match(shopsPage, /MILKRUN_SHOP_DEACTIVATE/);
    assert.match(shopsPage, /createMilkrunShop/);
    assert.match(shopsPage, /updateMilkrunShop/);
    assert.match(shopsPage, /deactivateMilkrunShop/);
    assert.match(masterApi, /getMilkrunShopById/);
    assert.match(tripCatalogPage, /createMilkrunTripType/);
    assert.match(tripCatalogPage, /updateMilkrunTripStatus/);
    assert.match(tripCatalogPage, /MILKRUN_TRIP_TYPE_CREATE/);
    assert.match(tripCatalogPage, /MILKRUN_TRIP_STATUS_DEACTIVATE/);
    assert.doesNotMatch(tripCatalogPage, /Chế độ chỉ đọc/);
    assert.match(routes, /key="trip-types"/);
    assert.match(routes, /key="trip-statuses"/);
    assert.doesNotMatch(navigation, /MILKRUN_TRIP_LOOKUP_READ_PERMISSIONS/);
    assert.doesNotMatch(`${routes}\n${navigation}`, /role\s*===|role\.includes/);
  });

  it('keeps stock transactions immutable and invalidates only stock caches', () => {
    const transactions = read('src/pages/milkrun/StockTransactionsPage.tsx');
    const adjustment = read('src/pages/milkrun/StockAdjustmentPage.tsx');
    assert.doesNotMatch(transactions, /onEdit|onDelete|updateMilkrunStockTransaction|deleteMilkrunStockTransaction/);
    assert.match(adjustment, /milkrunStockBalances\.all/);
    assert.match(adjustment, /milkrunStockTransactions\.all/);
    assert.match(adjustment, /adjustment_reason_id/);
  });

  it('shows driver names and does not expose driver UUID as normal UI output', () => {
    const list = read('src/pages/milkrun/TripsListPage.tsx');
    const detail = read('src/pages/milkrun/TripDetailPage.tsx');
    assert.match(list, /driver\.first_name/);
    assert.match(detail, /driver\.last_name/);
    assert.doesNotMatch(list, /:\s*trip\.driver_id/);
    assert.doesNotMatch(detail, /:\s*trip\.driver_id/);
  });
});

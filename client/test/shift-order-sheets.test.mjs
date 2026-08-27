import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const createOrder = read('src/pages/orders/CreateOrderPage.tsx');
const orderDetail = read('src/pages/orders/OrderDetailPage.tsx');
const sheetList = read('src/pages/orders/ShiftOrderSheetsPage.tsx');
const sheetDetail = read('src/pages/orders/ShiftOrderSheetDetailPage.tsx');
const sheetApi = read('src/api/shift-order-sheets.service.ts');
const routes = read('src/routes/workspace.routes.tsx');
const availabilityWarning = read('src/components/orders/StockAvailabilityWarning.tsx');
const http = read('src/api/http.ts');

describe('Supply Phase 9 shift-order-sheet UI', () => {
  it('uses the backend pagination contract for list and detail APIs', () => {
    assert.match(sheetApi, /supply\/shift-order-sheets/);
    assert.match(sheetApi, /PaginatedResponse<ShiftOrderSheetSummary>/);
    assert.match(sheetList, /usePaginatedResource/);
    assert.doesNotMatch(sheetList, /\.slice\(/);
  });

  it('registers list/detail routes and preserves the sheet context for Create More', () => {
    assert.match(routes, /path: 'shift-order-sheets'/);
    assert.match(routes, /path: 'shift-order-sheets\/:id'/);
    assert.match(sheetDetail, /shiftOrderSheetId=\$\{sheet\.id\}/);
    assert.match(createOrder, /shift_order_sheet_id: shiftOrderSheetId/);
  });

  it('shows current Order status from related backend data', () => {
    assert.match(sheetDetail, /status_lookup\?\.code/);
    assert.match(sheetDetail, /order\.code/);
    assert.doesNotMatch(sheetDetail, /statusHistory|snapshot_status/);
  });

  it('renders readable relations without UUID fallbacks', () => {
    assert.match(sheetDetail, /sheet\.leader\.first_name/);
    assert.match(sheetDetail, /sheet\.area\.name/);
    assert.match(sheetDetail, /sheet\.work_shift\.name/);
    assert.match(sheetDetail, /order\.requester\.first_name/);
    assert.doesNotMatch(sheetDetail, /\?\?\s*(sheet\.(leader_id|area_id|work_shift_id)|order\.requested_by)/);
  });

  it('blocks submit only at zero stock and preserves warning-only shortage behavior', () => {
    assert.match(orderDetail, /zeroStockItems\.length === 0/);
    assert.match(orderDetail, /ORDER_ITEM_ZERO_STOCK/);
    assert.match(orderDetail, /DRAFT/);
    assert.match(availabilityWarning, /Order vẫn có thể submit hoặc approve/);
    assert.match(availabilityWarning, /Tồn sẽ được kiểm tra lại khi issue/);
  });

  it('downloads Shift Sheet XLSX from backend with read permission and binary headers', () => {
    assert.match(sheetApi, /responseType:\s*'blob'/);
    assert.match(sheetApi, /content-disposition/);
    assert.match(sheetDetail, /Xuất Excel/);
    assert.match(sheetDetail, /Đang xuất\.\.\./);
    assert.match(sheetDetail, /ORDER_READ_PERMISSIONS/);
    assert.match(sheetDetail, /URL\.createObjectURL/);
    assert.match(http, /response\.config\.responseType === 'blob'/);
    assert.match(http, /:\s*response\.data/);
    assert.doesNotMatch(sheetDetail, /window\.location\.reload/);
  });
});

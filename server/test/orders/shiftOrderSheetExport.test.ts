import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  buildShiftOrderSheetExportRows,
  createShiftOrderSheetExportFilename,
  createShiftOrderSheetWorkbook,
  formatBusinessTime,
  SHIFT_ORDER_SHEET_EXPORT_HEADERS,
  SHIFT_ORDER_SHEET_WORKSHEET_NAME,
  type ShiftOrderSheetExportItem,
  type ShiftOrderSheetExportSource,
} from '../../src/services/shift-order-sheet-exporter';

const item = (overrides: Partial<ShiftOrderSheetExportItem> = {}): ShiftOrderSheetExportItem => ({
  id: 'item-normal',
  created_at: '2026-08-26T23:00:01Z',
  quantity_requested: 50,
  quantity_issued: 0,
  set_per_qty: null,
  requested_stack_quantity: null,
  note: null,
  supply: {
    code: '71000001',
    description: 'Mã thường',
    category: { code: 'NORMAL' },
  },
  provider: { code: 'NCC-A', name: 'Nhà cung cấp A' },
  ...overrides,
});

const source = (): ShiftOrderSheetExportSource => ({
  id: 'sheet-id',
  work_date: '2026-08-26',
  area: { code: 'EDC', name: 'EDC Logistics' },
  work_shift: { code: 'S3', name: 'Ca 3' },
  orders: [
    {
      id: 'order-normal',
      code: 'ORD-001',
      submitted_at: '2026-08-26T23:00:00Z',
      issued_at: null,
      note: 'Ghi chú Order',
      is_deleted: false,
      order_items: [item()],
    },
    {
      id: 'order-stack',
      code: 'ORD-002',
      submitted_at: '2026-08-27T00:00:00Z',
      issued_at: '2026-08-27T01:30:00Z',
      note: null,
      is_deleted: false,
      order_items: [
        item({
          id: 'item-stack-11',
          created_at: '2026-08-27T00:00:01Z',
          quantity_requested: 33,
          quantity_issued: 33,
          set_per_qty: 11,
          requested_stack_quantity: 3,
          note: 'Đúng 3 chồng',
          supply: {
            code: '71000861',
            description: 'Kiện sắt tiêu chuẩn',
            category: { code: 'KIEN_SAT_TC' },
          },
        }),
        item({
          id: 'item-stack-8',
          created_at: '2026-08-27T00:00:02Z',
          quantity_requested: 16,
          quantity_issued: 0,
          set_per_qty: 8,
          requested_stack_quantity: 2,
          supply: {
            code: '71000861',
            description: 'Kiện sắt tiêu chuẩn',
            category: { code: 'KIEN_SAT_TC' },
          },
          provider: { code: 'NCC-B', name: 'Nhà cung cấp B' },
        }),
      ],
    },
    {
      id: 'order-special',
      code: 'ORD-003',
      submitted_at: '2026-08-27T02:15:00+07:00',
      issued_at: null,
      note: null,
      is_deleted: false,
      order_items: [item({
        id: 'item-special',
        quantity_requested: 12,
        supply: {
          code: '71000999',
          description: 'Kiện sắt special',
          category: { code: 'KIEN_SAT_SPECIAL' },
        },
      })],
    },
    {
      id: 'order-partial',
      code: 'ORD-004',
      submitted_at: '2026-08-27T02:30:00+07:00',
      issued_at: '2026-08-27T02:40:00+07:00',
      note: null,
      is_deleted: false,
      order_items: [item({
        id: 'item-normal-partial',
        quantity_requested: 50,
        quantity_issued: 20,
      })],
    },
  ],
});

test('maps normal, special, stack and partial quantity semantics without aggregation', () => {
  const rows = buildShiftOrderSheetExportRows(source());
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((row) => [row.supplyCode, row.quantity, row.stackQuantity]), [
    ['71000001', 50, null],
    ['71000861', 33, 3],
    ['71000861', 16, 2],
    ['71000999', 12, null],
    ['71000001', 20, null],
  ]);
  assert.equal(rows[0]?.provider, 'NCC-A — Nhà cung cấp A');
  assert.equal(rows[2]?.provider, 'NCC-B — Nhà cung cấp B');
  assert.equal(rows[0]?.note, 'Ghi chú Order');
  assert.equal(rows[1]?.note, 'Đúng 3 chồng');
});

test('formats timestamps in Asia/Ho_Chi_Minh independently from process timezone', () => {
  assert.equal(formatBusinessTime('2026-08-26T23:00:00Z'), '06:00');
  assert.equal(formatBusinessTime('2026-08-27T01:30:00Z'), '08:30');
  assert.equal(formatBusinessTime('2026-08-27T02:15:00+07:00'), '02:15');
  assert.equal(formatBusinessTime(null), '');
});

test('generates a valid XLSX with exact headers, numeric cells and blanks', async () => {
  const buffer = await createShiftOrderSheetWorkbook(source());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.getWorksheet(SHIFT_ORDER_SHEET_WORKSHEET_NAME);
  assert.ok(worksheet);
  const headerValues = worksheet.getRow(1).values;
  assert.ok(Array.isArray(headerValues));
  assert.deepEqual(
    headerValues.slice(1),
    [...SHIFT_ORDER_SHEET_EXPORT_HEADERS],
  );
  assert.equal(worksheet.rowCount, 6);
  assert.equal(worksheet.getCell('C2').type, ExcelJS.ValueType.Number);
  assert.equal(worksheet.getCell('C2').value, 50);
  assert.equal(worksheet.getCell('D2').value, null);
  assert.equal(worksheet.getCell('F2').value, '06:00');
  assert.equal(worksheet.getCell('G2').value, null);
  assert.equal(worksheet.getCell('D3').type, ExcelJS.ValueType.Number);
  assert.equal(worksheet.getCell('D3').value, 3);
  assert.equal(worksheet.getCell('G3').value, '08:30');
});

test('creates readable deterministic filename from Sheet metadata', () => {
  assert.equal(
    createShiftOrderSheetExportFilename(source()),
    'Phieu_Order_Ca_EDC_S3_2026-08-26.xlsx',
  );
});

test('empty Sheet produces a valid header-only XLSX', async () => {
  const empty = source();
  empty.orders = [];
  const workbook = new ExcelJS.Workbook();
  const buffer = await createShiftOrderSheetWorkbook(empty);
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  assert.equal(workbook.getWorksheet(SHIFT_ORDER_SHEET_WORKSHEET_NAME)?.rowCount, 1);
});

test('does not fabricate stack count for unsupported partial Stack issue', () => {
  const inconsistent = source();
  inconsistent.orders = [{
    ...inconsistent.orders[1]!,
    order_items: [item({
      id: 'partial-stack',
      quantity_requested: 33,
      quantity_issued: 11,
      set_per_qty: 11,
      requested_stack_quantity: 3,
      supply: {
        code: '71000861',
        description: 'Kiện sắt tiêu chuẩn',
        category: { code: 'KIEN_SAT_TC' },
      },
    })],
  }];
  assert.throws(
    () => buildShiftOrderSheetExportRows(inconsistent),
    /issue một phần chưa được hỗ trợ/,
  );
});

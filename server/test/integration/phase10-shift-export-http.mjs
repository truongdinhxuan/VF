import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import Fastify from 'fastify';
import app from '../../dist/app.js';

const ids = {
  manager: '69200000-0000-4000-8000-000000000001',
  outsider: '69200000-0000-4000-8000-000000000003',
  sheet: '69320000-0000-4000-8000-000000000001',
};

const signToken = (subject) => {
  const secret = process.env.APP_JWT_SECRET;
  assert.ok(secret);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: subject, exp: Math.floor(Date.now() / 1000) + 300 });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const server = Fastify({ logger: false });
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(supabaseUrl);
  assert.ok(supabaseServiceRoleKey);
  const database = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await server.register(app);
  await server.ready();
  const auth = (id) => ({ authorization: `Bearer ${signToken(id)}` });

  const beforeSheet = await database
    .from('supply_shift_order_sheets')
    .select('id,area_id,work_shift_id,work_date,leader_id,is_active,is_deleted,updated_at')
    .eq('id', ids.sheet)
    .single();
  const beforeOrders = await database
    .from('orders')
    .select('id,status_id,shift_order_sheet_id,submitted_at,issued_at,updated_at')
    .like('code', 'P10-EXPORT-%')
    .order('id');
  const beforeItems = await database
    .from('order_items')
    .select('id,quantity_requested,quantity_approved,quantity_issued,updated_at')
    .in('order_id', beforeOrders.data?.map((row) => row.id) ?? [])
    .order('id');
  const beforeStock = await database
    .from('stock_balances')
    .select('id,supply_id,provider_id,area_id,storage_location_id,quantity,set_per_qty,stack_quantity,total_set_quantity,updated_at')
    .order('id');
  const beforeTransactions = await database
    .from('stock_transactions')
    .select('id', { count: 'exact', head: true });
  const beforeDiscrepancies = await database
    .from('inventory_discrepancies')
    .select('id', { count: 'exact', head: true });
  const beforeRevisions = await database
    .from('order_revisions')
    .select('id', { count: 'exact', head: true });
  const beforeNotifications = await database
    .from('notifications')
    .select('id', { count: 'exact', head: true });
  assert.equal(beforeSheet.error, null);
  assert.equal(beforeOrders.error, null);
  assert.equal(beforeItems.error, null);
  assert.equal(beforeStock.error, null);
  assert.equal(beforeTransactions.error, null);
  assert.equal(beforeDiscrepancies.error, null);
  assert.equal(beforeRevisions.error, null);
  assert.equal(beforeNotifications.error, null);

  const response = await server.inject({
    method: 'GET',
    url: `/supply/shift-order-sheets/${ids.sheet}/export`,
    headers: auth(ids.manager),
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers['content-type'], /spreadsheetml\.sheet/);
  assert.match(
    response.headers['content-disposition'],
    /Phieu_Order_Ca_EDC_LOGISTICS_S3_2026-08-26\.xlsx/,
  );
  assert.equal(response.rawPayload.subarray(0, 2).toString(), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.rawPayload);
  const worksheet = workbook.getWorksheet('Phiếu Order Ca');
  assert.ok(worksheet);
  assert.deepEqual(worksheet.getRow(1).values.slice(1), [
    'Mã hàng', 'Tên mã', 'Số lượng', 'Số chồng',
    'Nhà cung cấp', 'Giờ order', 'Giờ nhận hàng', 'Note',
  ]);
  assert.equal(worksheet.rowCount, 6);

  const rows = [];
  worksheet.eachRow((row, number) => {
    if (number > 1) rows.push(row.values.slice(1));
  });
  const normal = rows.find((row) => row[0] === 'P10_EXPORT_NORMAL' && row[2] === 50);
  assert.ok(normal);
  assert.equal(normal[3], undefined);
  assert.equal(normal[5], '06:00');
  assert.equal(normal[6], undefined);
  assert.equal(normal[7], 'Ghi chú Order thường');

  const stack11 = rows.find((row) => row[0] === 'P10_EXPORT_STACK' && row[3] === 3);
  const stack8 = rows.find((row) => row[0] === 'P10_EXPORT_STACK' && row[3] === 2);
  assert.ok(stack11);
  assert.ok(stack8);
  assert.equal(stack11[2], 33);
  assert.equal(stack11[6], '08:30');
  assert.match(stack11[4], /P10_PROVIDER_A.*Nhà cung cấp A/);
  assert.equal(stack8[2], 16);
  assert.match(stack8[4], /P10_PROVIDER_B.*Nhà cung cấp B/);

  const special = rows.find((row) => row[0] === 'P10_EXPORT_SPECIAL');
  assert.ok(special);
  assert.equal(special[2], 12);
  assert.equal(special[3], undefined);
  assert.equal(special[5], '02:15');
  assert.equal(special[6], undefined);
  assert.equal(special[7], 'Ghi chú item special');
  assert.equal(rows.some((row) => row[2] === 99), false);
  assert.ok(rows.some((row) => row[2] === 20 && row[3] === undefined));

  const forbiddenDetail = await server.inject({
    method: 'GET',
    url: `/supply/shift-order-sheets/${ids.sheet}`,
    headers: auth(ids.outsider),
  });
  assert.equal(forbiddenDetail.statusCode, 403, forbiddenDetail.body);

  const forbidden = await server.inject({
    method: 'GET',
    url: `/supply/shift-order-sheets/${ids.sheet}/export`,
    headers: auth(ids.outsider),
  });
  assert.equal(forbidden.statusCode, 403, forbidden.body);

  const notFound = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets/69399999-0000-4000-8000-000000000099/export',
    headers: auth(ids.manager),
  });
  assert.equal(notFound.statusCode, 404, notFound.body);

  const afterSheet = await database
    .from('supply_shift_order_sheets')
    .select('id,area_id,work_shift_id,work_date,leader_id,is_active,is_deleted,updated_at')
    .eq('id', ids.sheet)
    .single();
  const afterOrders = await database
    .from('orders')
    .select('id,status_id,shift_order_sheet_id,submitted_at,issued_at,updated_at')
    .like('code', 'P10-EXPORT-%')
    .order('id');
  const afterItems = await database
    .from('order_items')
    .select('id,quantity_requested,quantity_approved,quantity_issued,updated_at')
    .in('order_id', afterOrders.data?.map((row) => row.id) ?? [])
    .order('id');
  const afterStock = await database
    .from('stock_balances')
    .select('id,supply_id,provider_id,area_id,storage_location_id,quantity,set_per_qty,stack_quantity,total_set_quantity,updated_at')
    .order('id');
  const afterTransactions = await database
    .from('stock_transactions')
    .select('id', { count: 'exact', head: true });
  const afterDiscrepancies = await database
    .from('inventory_discrepancies')
    .select('id', { count: 'exact', head: true });
  const afterRevisions = await database
    .from('order_revisions')
    .select('id', { count: 'exact', head: true });
  const afterNotifications = await database
    .from('notifications')
    .select('id', { count: 'exact', head: true });
  assert.equal(afterSheet.error, null);
  assert.equal(afterOrders.error, null);
  assert.equal(afterItems.error, null);
  assert.equal(afterStock.error, null);
  assert.equal(afterTransactions.error, null);
  assert.equal(afterDiscrepancies.error, null);
  assert.equal(afterRevisions.error, null);
  assert.equal(afterNotifications.error, null);
  assert.deepEqual(afterSheet.data, beforeSheet.data);
  assert.deepEqual(afterOrders.data, beforeOrders.data);
  assert.deepEqual(afterItems.data, beforeItems.data);
  assert.deepEqual(afterStock.data, beforeStock.data);
  assert.equal(afterTransactions.count, beforeTransactions.count);
  assert.equal(afterDiscrepancies.count, beforeDiscrepancies.count);
  assert.equal(afterRevisions.count, beforeRevisions.count);
  assert.equal(afterNotifications.count, beforeNotifications.count);

  console.log(JSON.stringify({
    exportedRows: rows.length,
    stockBalanceRowsBeforeAndAfter: beforeStock.data?.length ?? 0,
    stockTransactionCountBeforeAndAfter: beforeTransactions.count,
    discrepancyCountBeforeAndAfter: beforeDiscrepancies.count,
    orderRevisionCountBeforeAndAfter: beforeRevisions.count,
    notificationCountBeforeAndAfter: beforeNotifications.count,
  }));
  console.log('phase10-shift-export-http: PASS');
} finally {
  await server.close();
}

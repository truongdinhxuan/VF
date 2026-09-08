import assert from 'node:assert/strict';
import Fastify from 'fastify';
import app from '../../dist/app.js';
import { createSessionAuth } from './session-auth-helper.mjs';

const ids = {
  manager: '69200000-0000-4000-8000-000000000001',
  packing: '69200000-0000-4000-8000-000000000002',
  outsider: '69200000-0000-4000-8000-000000000003',
  sheet: '69200000-0000-4000-8000-000000000011',
};

const server = Fastify({ logger: false });
let sessionAuth;
try {
  await server.register(app);
  await server.ready();
  sessionAuth = await createSessionAuth([ids.manager, ids.packing, ids.outsider]);
  const { auth } = sessionAuth;

  const filtered = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets?page=1&pageSize=1&workDate=2026-09-02&sortBy=work_date&sortOrder=desc',
    headers: auth(ids.manager),
  });
  assert.equal(filtered.statusCode, 200, filtered.body);
  assert.equal(filtered.json().pagination.total, 1);
  assert.equal(filtered.json().data[0].work_date, '2026-09-02');
  assert.equal(filtered.json().data[0].work_shift.code, 'S1');
  const { work_shift_id: workShiftId, leader_id: leaderId } = filtered.json().data[0];

  const relationFilters = await server.inject({
    method: 'GET',
    url: `/supply/shift-order-sheets?page=1&pageSize=20&workShiftId=${workShiftId}&leaderId=${leaderId}`,
    headers: auth(ids.manager),
  });
  assert.equal(relationFilters.statusCode, 200, relationFilters.body);
  assert.equal(relationFilters.json().pagination.total, 2);

  const packing = await server.inject({
    method: 'GET', url: '/supply/shift-order-sheets?page=1&pageSize=20', headers: auth(ids.packing),
  });
  assert.equal(packing.statusCode, 200, packing.body);
  assert.equal(packing.json().pagination.total, 2);

  const outsider = await server.inject({
    method: 'GET', url: '/supply/shift-order-sheets?page=1&pageSize=20', headers: auth(ids.outsider),
  });
  assert.equal(outsider.statusCode, 200, outsider.body);
  assert.equal(outsider.json().pagination.total, 0);

  const forbiddenDetail = await server.inject({
    method: 'GET', url: `/supply/shift-order-sheets/${ids.sheet}`, headers: auth(ids.outsider),
  });
  assert.equal(forbiddenDetail.statusCode, 403, forbiddenDetail.body);

  const invalidSort = await server.inject({
    method: 'GET', url: '/supply/shift-order-sheets?sortBy=leader_name', headers: auth(ids.manager),
  });
  assert.equal(invalidSort.statusCode, 400, invalidSort.body);

  console.log('phase9-shift-order-sheets-http: PASS');
} finally {
  await sessionAuth?.cleanup();
  await server.close();
}

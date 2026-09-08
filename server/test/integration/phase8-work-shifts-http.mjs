import assert from 'node:assert/strict';
import Fastify from 'fastify';
import app from '../../dist/app.js';
import { createSessionAuth } from './session-auth-helper.mjs';

const managerId = '68000000-0000-4000-8000-000000000011';
const readerId = '68000000-0000-4000-8000-000000000012';
const targetId = '68000000-0000-4000-8000-000000000013';

const server = Fastify({ logger: false });
let sessionAuth;
try {
  await server.register(app);
  await server.ready();
  sessionAuth = await createSessionAuth([managerId, readerId]);
  const managerToken = sessionAuth.tokenFor(managerId);
  const readerToken = sessionAuth.tokenFor(readerId);
  const authorization = (token) => ({ authorization: `Bearer ${token}` });

  const listResponse = await server.inject({
    method: 'GET', url: '/shared/work-shifts', headers: authorization(managerToken),
  });
  assert.equal(listResponse.statusCode, 200, listResponse.body);
  const shiftEnvelope = listResponse.json();
  assert.deepEqual(shiftEnvelope.data.map((shift) => shift.code).sort(), ['HC', 'S1', 'S2', 'S3', 'S6', 'S7']);
  const s1 = shiftEnvelope.data.find((shift) => shift.code === 'S1');
  assert.ok(s1);

  const assignResponse = await server.inject({
    method: 'POST',
    url: '/shared/user-work-shift-assignments',
    headers: authorization(managerToken),
    payload: {
      user_id: targetId,
      work_shift_id: s1.id,
      effective_from: '2026-08-01T00:00:00.000Z',
    },
  });
  assert.equal(assignResponse.statusCode, 201, assignResponse.body);

  const historyResponse = await server.inject({
    method: 'GET',
    url: `/shared/user-work-shift-assignments?user_id=${targetId}`,
    headers: authorization(managerToken),
  });
  assert.equal(historyResponse.statusCode, 200, historyResponse.body);
  assert.equal(historyResponse.json().data.current.work_shift.code, 'S1');

  const forbiddenResponse = await server.inject({
    method: 'POST',
    url: '/shared/user-work-shift-assignments',
    headers: authorization(readerToken),
    payload: {
      user_id: targetId,
      work_shift_id: s1.id,
      effective_from: '2026-08-02T00:00:00.000Z',
    },
  });
  assert.equal(forbiddenResponse.statusCode, 403, forbiddenResponse.body);

  console.log('phase8-work-shifts-http: PASS');
} finally {
  await sessionAuth?.cleanup();
  await server.close();
}

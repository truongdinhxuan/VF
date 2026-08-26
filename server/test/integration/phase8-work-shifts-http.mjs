import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import app from '../../dist/app.js';

const managerId = '68000000-0000-4000-8000-000000000011';
const readerId = '68000000-0000-4000-8000-000000000012';
const targetId = '68000000-0000-4000-8000-000000000013';

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
  await server.register(app);
  await server.ready();
  const managerToken = signToken(managerId);
  const readerToken = signToken(readerId);
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
  await server.close();
}

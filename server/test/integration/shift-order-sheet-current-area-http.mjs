import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import app from '../../dist/app.js';

const ids = {
  areaAUser: '69500000-0000-4000-8000-000000000011',
  areaBUser: '69500000-0000-4000-8000-000000000012',
  areaAPeer: '69500000-0000-4000-8000-000000000013',
  areaASheet: '69500000-0000-4000-8000-000000000031',
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
  await server.register(app);
  await server.ready();
  const auth = (id) => ({ authorization: `Bearer ${signToken(id)}` });

  const currentA = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets/current',
    headers: auth(ids.areaAUser),
  });
  assert.equal(currentA.statusCode, 200, currentA.body);
  assert.equal(currentA.json().data.context.area.code, 'SO_AREA_A');
  assert.equal(currentA.json().data.sheet.id, ids.areaASheet);

  const currentAAgain = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets/current',
    headers: auth(ids.areaAUser),
  });
  assert.equal(currentAAgain.statusCode, 200, currentAAgain.body);
  assert.equal(currentAAgain.json().data.sheet.id, ids.areaASheet);

  const currentAPeer = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets/current',
    headers: auth(ids.areaAPeer),
  });
  assert.equal(currentAPeer.statusCode, 200, currentAPeer.body);
  assert.equal(currentAPeer.json().data.sheet.id, ids.areaASheet);

  const currentB = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets/current',
    headers: auth(ids.areaBUser),
  });
  assert.equal(currentB.statusCode, 200, currentB.body);
  assert.equal(currentB.json().data.context.area.code, 'SO_AREA_B');
  assert.equal(currentB.json().data.sheet, null);

  const wrongArea = await server.inject({
    method: 'GET',
    url: `/supply/shift-order-sheets/${ids.areaASheet}`,
    headers: auth(ids.areaBUser),
  });
  assert.equal(wrongArea.statusCode, 403, wrongArea.body);

  const historyA = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets?page=1&pageSize=20',
    headers: auth(ids.areaAUser),
  });
  assert.equal(historyA.statusCode, 200, historyA.body);
  assert.equal(historyA.json().data.length, 1);
  assert.equal(historyA.json().data[0].area.code, 'SO_AREA_A');

  const historyB = await server.inject({
    method: 'GET',
    url: '/supply/shift-order-sheets?page=1&pageSize=20',
    headers: auth(ids.areaBUser),
  });
  assert.equal(historyB.statusCode, 200, historyB.body);
  assert.equal(historyB.json().data.length, 0);

  console.log('shift-order-sheet-current-area-http: PASS');
} finally {
  await server.close();
}

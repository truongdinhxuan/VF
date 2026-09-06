// Opt-in local integration: P4_CONFIRM_ACTOR_ID must identify a dedicated,
// active/verified local fixture user with the required mutation permissions.
// No production/remote URL is accepted. This is not part of the Vite entry point.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  configureDisposableLocalSupabase,
  requireServer,
  serverDirectory,
} from './project-test-environment.mjs';

const status = JSON.parse(execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx.cmd supabase status -o json'], {
  cwd: serverDirectory,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}));
configureDisposableLocalSupabase(status);
assert.ok(process.env.APP_JWT_SECRET, 'APP_JWT_SECRET must be configured in server/.env');

const Fastify = requireServer('fastify');
const { createClient } = requireServer('@supabase/supabase-js');
const app = requireServer('./dist/app.js').default;
const database = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const server = Fastify({ logger: false });
const created = [];
const failures = [];
const actorId = process.env.P4_CONFIRM_ACTOR_ID;

try {
  assert.match(actorId ?? '', /^[0-9a-f-]{36}$/i, 'Set P4_CONFIRM_ACTOR_ID to a local fixture user');
  const actor = await database.from('users').select('email').eq('id', actorId).single();
  assert.equal(actor.error, null);
  assert.match(actor.data.email, /@example\.test$/, 'Only a dedicated test fixture actor is accepted');
  await server.register(app);
  await server.ready();
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: actorId, exp: Math.floor(Date.now() / 1000) + 300 });
  const signature = createHmac('sha256', process.env.APP_JWT_SECRET)
    .update(`${header}.${payload}`).digest('base64url');
  const authorization = `Bearer ${header}.${payload}.${signature}`;
  for (const entry of [
    { path: '/providers', table: 'providers', schema: 'public', suffix: '/deactivate', method: 'PATCH' },
    { path: '/roles', table: 'roles', schema: 'public', suffix: '', method: 'DELETE' },
    { path: '/milkrun/shops', table: 'shops', schema: 'milkrun', suffix: '/deactivate', method: 'PATCH' },
  ]) {
    try {
    const response = await server.inject({
      method: 'POST', url: entry.path, headers: { authorization },
      payload: { code: `P4_CONFIRM_${entry.table.toUpperCase()}_${Date.now()}`, name: 'Phase 4 confirmation fixture' },
    });
    assert.equal(response.statusCode, 201, `${entry.path}: ${response.body}`);
    const item = response.json().data;
    assert.ok(item?.id);
    created.push({ ...entry, id: item.id });
    const result = await server.inject({
      method: entry.method, url: `${entry.path}/${item.id}${entry.suffix}`, headers: { authorization },
    });
    assert.equal(result.statusCode, 200, `${entry.path}: ${result.body}`);
    const stored = await database.schema(entry.schema).from(entry.table)
      .select('id,is_active,is_deleted').eq('id', item.id).single();
    assert.equal(stored.error, null);
    assert.equal(stored.data.is_active, false);
    if (entry.table === 'roles') assert.equal(stored.data.is_deleted, true);
    console.log(`PASS ${entry.method} ${entry.path}/:id${entry.suffix}: stored inactive`);
    } catch (error) {
      failures.push(entry.path);
      console.error(`FAIL ${entry.path}: ${error.message}`);
    }
  }
  const denied = await server.inject({ method: 'PATCH', url: `/providers/${actorId}/deactivate` });
  assert.equal(denied.statusCode, 401);
  console.log('PASS unauthenticated mutation rejected: 401');
  assert.deepEqual(failures, [], 'Local API integration failures');
} finally {
  for (const item of created.reverse()) {
    const result = await database.schema(item.schema).from(item.table).delete().eq('id', item.id);
    assert.equal(result.error, null, `Fixture cleanup failed: ${item.table}`);
  }
  await server.close();
  console.log(`Cleaned ${created.length} uniquely created resource fixtures.`);
}

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const requireServer = createRequire(new URL('../../../server/package.json', import.meta.url));
export const serverDirectory = fileURLToPath(new URL('../../../server/', import.meta.url));

const dotenv = requireServer('dotenv');

// Manual verification must follow the same checked-in project configuration
// convention as the applications. Existing shell variables intentionally win.
dotenv.config({
  path: fileURLToPath(new URL('../../../server/.env', import.meta.url)),
  override: false,
  quiet: true,
});
dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  override: false,
  quiet: true,
});

const requiredUrl = (name) => {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} must be configured in the project environment`);
  const url = new URL(value);
  assert.ok(['http:', 'https:'].includes(url.protocol), `${name} must use http or https`);
  return url;
};

export const frontendOrigin = requiredUrl('ORIGIN_URL');
export const backendApiUrl = requiredUrl('VITE_API_URL');

export const assertLoopbackUrl = (url, label) => {
  const hostname = url.hostname.toLowerCase();
  assert.ok(
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]',
    `${label} must be a loopback URL for disposable local verification`,
  );
};

export const configureDisposableLocalSupabase = (status) => {
  const localSupabaseUrl = new URL(status.API_URL);
  assertLoopbackUrl(localSupabaseUrl, 'Supabase CLI API_URL');
  assert.ok(status.SERVICE_ROLE_KEY, 'Supabase CLI SERVICE_ROLE_KEY is required');

  // The fixture suite is intentionally isolated from the remote SUPABASE_URL
  // in server/.env. Values come from `supabase status`, never a guessed URL.
  process.env.SUPABASE_URL = localSupabaseUrl.origin;
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  return localSupabaseUrl;
};

export const backendListenOptions = () => {
  assert.equal(backendApiUrl.protocol, 'http:', 'Manual Fastify verification requires an HTTP API URL');
  assert.equal(backendApiUrl.pathname, '/', 'VITE_API_URL must not include an API path for this harness');
  assertLoopbackUrl(backendApiUrl, 'VITE_API_URL');
  assertLoopbackUrl(frontendOrigin, 'ORIGIN_URL');

  const port = Number(backendApiUrl.port || 80);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'VITE_API_URL has an invalid port');
  return { host: backendApiUrl.hostname, port };
};

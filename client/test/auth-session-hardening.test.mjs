import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { createSingleFlight } from '../src/api/single-flight.ts';
import {
  getAccessToken,
  notifyAuthenticationLost,
  setAccessToken,
  setAuthenticationLostHandler,
} from '../src/api/auth-token.ts';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AUTH Phase 1 frontend session hardening', () => {
  it('keeps access tokens in module memory and only removes legacy storage', () => {
    const tokenStore = read('src/api/auth-token.ts');
    const runtime = [
      read('src/api/http.ts'),
      read('src/context/AuthContext.tsx'),
      read('src/components/ProtectedRoute.tsx'),
      read('src/hooks/useSupplyRealtime.ts'),
    ].join('\n');
    assert.match(tokenStore, /let accessToken: string \| null = null/);
    assert.match(tokenStore, /localStorage\.removeItem\('access_token'\)/);
    assert.doesNotMatch(runtime, /localStorage\.(getItem|setItem)\(['"]access_token/);
  });

  it('uses credentialed Axios and one shared in-flight refresh request', () => {
    const http = read('src/api/http.ts');
    assert.match(http, /withCredentials: true/);
    assert.match(http, /createSingleFlight/);
    assert.match(http, /config\._authRetry = true/);
    assert.match(http, /return instance\.request\(config\)/);
    assert.doesNotMatch(http, /window\.location|queryClient\.clear/);
  });

  it('coalesces concurrent refreshes and permits a later rotation', async () => {
    let calls = 0;
    const refresh = createSingleFlight(async () => {
      calls += 1;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      return calls;
    });
    const firstBatch = await Promise.all([refresh(), refresh(), refresh(), refresh()]);
    assert.deepEqual(firstBatch, [1, 1, 1, 1]);
    assert.equal(calls, 1);
    assert.equal(await refresh(), 2);
  });

  it('clears memory state through the shared authentication-loss hook', () => {
    let resetCount = 0;
    setAuthenticationLostHandler(() => { resetCount += 1; });
    setAccessToken('temporary-access');
    notifyAuthenticationLost();
    assert.equal(getAccessToken(), null);
    assert.equal(resetCount, 1);
    setAuthenticationLostHandler(null);
  });

  it('bootstraps from refresh cookie and performs backend logout before local cleanup', () => {
    const auth = read('src/context/AuthContext.tsx');
    assert.match(auth, /refreshAccessSession\(\)/);
    assert.match(auth, /await logout\(\)/);
    assert.match(auth, /finally[\s\S]*notifyAuthenticationLost\(\)/);
    assert.match(auth, /queryClient\.clear\(\)/);
  });

  it('uses the current memory token for SSE and refreshes on stream 401', () => {
    const realtime = read('src/hooks/useSupplyRealtime.ts');
    assert.match(realtime, /Authorization: `Bearer \$\{accessToken\}`/);
    assert.match(realtime, /credentials: 'include'/);
    assert.match(realtime, /response\.status === 401[\s\S]*refreshAccessSession\(\)/);
    assert.match(realtime, /controller\?\.abort\(\)/);
  });
});

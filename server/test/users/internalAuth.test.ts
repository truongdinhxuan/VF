import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  hashPassword,
  isStrongPassword,
  verifyPassword,
} from '../../src/utils/password';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('internal VinFast ID authentication', () => {
  it('hashes passwords with a unique salt and verifies in constant-time form', async () => {
    const password = 'Internal1!';
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    assert.notEqual(firstHash, secondHash);
    assert.equal(await verifyPassword(password, firstHash), true);
    assert.equal(await verifyPassword('Wrong1!x', firstHash), false);
    assert.equal(await verifyPassword(password, 'invalid-hash'), false);
  });

  it('enforces the shared password strength contract', () => {
    assert.equal(isStrongPassword('Internal1!'), true);
    assert.equal(isStrongPassword('lowercase1!'), false);
    assert.equal(isStrongPassword('NoNumber!!'), false);
    assert.equal(isStrongPassword('NoSpecial1'), false);
  });

  it('uses VinFast ID login and backend JWT without Supabase Auth calls', () => {
    const login = read('src/controllers/auth/login.ts');
    const middleware = read('src/middleware/auth.ts');
    const service = read('src/services/users.service.ts');
    const dbContext = read('src/plugins/dbContext.ts');

    assert.match(login, /vinfast_id/);
    assert.match(login, /reply\.jwtSign/);
    assert.match(middleware, /request\.jwtVerify/);
    assert.match(service, /user_credentials/);
    assert.doesNotMatch(
      [login, middleware, service, dbContext].join('\n'),
      /supabase\.auth|auth\.admin|signInWithPassword/,
    );
  });

  it('lets ADMIN assign credentials while self-service requires the current password', () => {
    const controller = read('src/controllers/users/update-password.ts');
    const service = read('src/services/users.service.ts');
    const schema = read('src/schemas/users.ts');

    assert.match(controller, /request\.user\.role === ROLE_CODE\.ADMIN/);
    assert.match(controller, /if \(isSelf\)/);
    assert.match(controller, /if \(!currentPassword\)/);
    assert.match(controller, /service\.setPassword/);
    assert.match(service, /async setPassword/);
    assert.match(service, /\.from\('user_credentials'\)[\s\S]*\.upsert/);
    assert.doesNotMatch(
      schema.match(/export const updatePasswordSchema[\s\S]*$/)?.[0] ?? '',
      /required:\s*\[[^\]]*'currentPassword'/,
    );
  });

  it('protects credentials and restricts atomic user creation to service_role', () => {
    const migration = read(
      'supabase/migrations/202607300001_internal_password_auth.sql',
    );

    assert.match(migration, /enable row level security/i);
    assert.match(
      migration,
      /revoke all on table public\.user_credentials from public, anon, authenticated/i,
    );
    assert.match(migration, /security definer/i);
    assert.match(
      migration,
      /grant execute on function public\.create_internal_user[\s\S]*to service_role/i,
    );
  });
});

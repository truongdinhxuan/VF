import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607150001_user_names_and_verification.sql'),
  'utf8',
);
const authMiddleware = readFileSync(
  resolve(process.cwd(), 'src/middleware/auth.ts'),
  'utf8',
);
const authorizationService = readFileSync(
  resolve(process.cwd(), 'src/services/authorization.service.ts'),
  'utf8',
);
const loginController = readFileSync(
  resolve(process.cwd(), 'src/controllers/auth/login.ts'),
  'utf8',
);
const usersService = readFileSync(
  resolve(process.cwd(), 'src/services/users.service.ts'),
  'utf8',
);
const internalAuthMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607300001_internal_password_auth.sql'),
  'utf8',
);

describe('user name and approval migration', () => {
  it('backfills split names before removing full_name', () => {
    assert.match(migration, /add column if not exists first_name text/i);
    assert.match(migration, /add column if not exists last_name text/i);
    assert.match(migration, /set[\s\S]*last_name[\s\S]*first_name/i);
    assert.match(migration, /drop column if exists full_name/i);
  });

  it('adds a non-null verification flag defaulting to false', () => {
    assert.match(migration, /add column if not exists is_verified boolean/i);
    assert.match(migration, /alter column is_verified set default false/i);
    assert.match(migration, /alter column is_verified set not null/i);
  });

  it('preserves a legacy approval value when available', () => {
    assert.match(migration, /to_jsonb\(u\) \? 'isverified'/i);
    assert.match(migration, /drop column if exists isverified/i);
  });
});

describe('verified-account access enforcement', () => {
  it('checks is_verified in the shared internal-data guard', () => {
    assert.match(authMiddleware, /getEffectivePermissions/);
    assert.match(authorizationService, /is_verified/);
    assert.match(authorizationService, /is_deleted/);
    assert.match(authorizationService, /if \(!user\.is_verified\)/i);
    assert.match(authorizationService, /if \(!user\.is_active \|\| user\.is_deleted\)/i);
  });

  it('does not return a login token for an unverified account', () => {
    const approvalCheck = usersService.indexOf('if (!profile.is_verified)');
    const authenticate = loginController.indexOf('.authenticate(');
    const tokenResponse = loginController.indexOf('reply.jwtSign');
    assert.ok(approvalCheck >= 0);
    assert.ok(authenticate >= 0);
    assert.ok(tokenResponse > authenticate);
  });

  it('creates new managed users as unverified', () => {
    assert.match(
      internalAuthMigration,
      /is_verified,[\s\S]*is_active,[\s\S]*is_deleted[\s\S]*false,[\s\S]*true,[\s\S]*false/i,
    );
  });
});

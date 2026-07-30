import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { USER_COLUMNS } from '../../src/interfaces/users';

const expectedUserColumns = [
  'id',
  'vinfast_id',
  'email',
  'phone_number',
  'avatar_url',
  'role_id',
  'area_id',
  'managed_by_user_id',
  'is_active',
  'is_verified',
  'is_deleted',
  'created_at',
  'updated_at',
  'first_name',
  'last_name',
];

const runtimeUserFiles = [
  'src/controllers/auth/login.ts',
  'src/controllers/users/create.ts',
  'src/controllers/users/detail.ts',
  'src/controllers/users/list.ts',
  'src/controllers/users/update.ts',
  'src/interfaces/users.ts',
  'src/middleware/auth.ts',
  'src/services/users.service.ts',
].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'));

const phase1Migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607140001_application_phase1.sql'),
  'utf8',
);
const lookupFoundationMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607290001_lookup_master_data_foundation.sql'),
  'utf8',
);
const authRoutes = readFileSync(
  resolve(process.cwd(), 'src/routes/auth/index.ts'),
  'utf8',
);
const userRoutes = readFileSync(
  resolve(process.cwd(), 'src/routes/users/index.ts'),
  'utf8',
);
const usersService = readFileSync(
  resolve(process.cwd(), 'src/services/users.service.ts'),
  'utf8',
);
const addAdminRoleMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607200001_add_admin_role_enum.sql'),
  'utf8',
);
const seedAdminRoleMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607200002_seed_admin_role.sql'),
  'utf8',
);

describe('current users schema contract', () => {
  it('uses the exact current users columns in Supabase projections', () => {
    assert.deepEqual(
      [...USER_COLUMNS],
      expectedUserColumns,
    );
  });

  it('keeps UserRecord exactly aligned with the database table', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/interfaces/database.ts'),
      'utf8',
    );
    const block = source.match(/export interface UserRecord \{([\s\S]*?)\n\}/)?.[1];
    assert.ok(block);

    const properties = [...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]);
    assert.deepEqual(properties, expectedUserColumns);
  });

  it('contains no legacy users fields in runtime code', () => {
    const runtimeSource = runtimeUserFiles.join('\n');
    assert.doesNotMatch(
      runtimeSource,
      /\b(?:full_name|isVerified|managed_by|create_at|update_at)\b(?=\s*[:?])/,
    );
  });

  it('does not use wildcard user projections', () => {
    const querySource = runtimeUserFiles.join('\n');
    assert.doesNotMatch(querySource, /from\('users'\)[\s\S]{0,160}\.select\(\s*['"]\*['"]/);
    assert.doesNotMatch(querySource, /from\('users'\)[\s\S]{0,160}\.select\(\s*\)/);
  });

  it('uses is_active directly in the phase 1 migration', () => {
    assert.match(
      phase1Migration,
      /update public\.users set is_active = true where is_active is null/i,
    );
  });

  it('removes Position and adds the current soft-delete field forward-only', () => {
    assert.match(lookupFoundationMigration, /drop column if exists position_id/i);
    assert.match(
      lookupFoundationMigration,
      /add column if not exists is_deleted boolean not null default false/i,
    );
  });

  it('uses Admin-managed user creation instead of public registration', () => {
    assert.doesNotMatch(authRoutes, /register/i);
    assert.match(userRoutes, /fastify\.post\(/);
    assert.match(userRoutes, /verifyTokenAndRole\(USER_MANAGER_ROLES\)/);
  });

  it('updates profile email without depending on Supabase Auth', () => {
    assert.match(usersService, /payload\.email/);
    assert.doesNotMatch(usersService, /auth\.admin|supabase\.auth/);
    assert.doesNotMatch(usersService, /authEmailChanged|email_confirm/);
  });

  it('keeps the legacy Admin seed replay-safe during lookup migration', () => {
    assert.match(addAdminRoleMigration, /add value if not exists 'Admin'/i);
    assert.match(seedAdminRoleMigration, /values \('Admin'\)/i);
    assert.match(seedAdminRoleMigration, /on conflict \(role_name\) do nothing/i);
    assert.match(
      lookupFoundationMigration,
      /\('Admin', 'ADMIN', 'Admin'\)/i,
    );
  });
});

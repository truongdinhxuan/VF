import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../../src/plugins/dbContext';
import '../../src/plugins/jwt';
import {
  PERMISSION_CODE,
  PERMISSION_CODES,
  type PermissionCode,
} from '../../src/domain/permission-codes';
import {
  permissionRequirementSatisfied,
  requirePermission,
} from '../../src/middleware/auth';
import {
  AuthorizationError,
  resolveEffectivePermissions,
} from '../../src/services/authorization.service';

const activeUser = {
  id: 'user-1',
  email: 'user@example.com',
  area_id: 'area-1',
  is_active: true,
  is_verified: true,
  is_deleted: false,
};

const role = (
  id: string,
  code: string,
  overrides: Partial<{
    name: string;
    is_system: boolean;
    is_active: boolean;
    is_deleted: boolean;
  }> = {},
) => ({
  id,
  code,
  name: overrides.name ?? code,
  is_system: overrides.is_system ?? false,
  is_active: overrides.is_active ?? true,
  is_deleted: overrides.is_deleted ?? false,
});

const userRole = (
  roleRow: ReturnType<typeof role>,
  overrides: Partial<{ is_active: boolean; is_deleted: boolean }> = {},
) => ({
  role_id: roleRow.id,
  is_active: overrides.is_active ?? true,
  is_deleted: overrides.is_deleted ?? false,
  role: roleRow,
});

const rolePermission = (
  roleId: string,
  code: PermissionCode,
  overrides: Partial<{
    mappingActive: boolean;
    mappingDeleted: boolean;
    permissionActive: boolean;
    permissionDeleted: boolean;
  }> = {},
) => ({
  role_id: roleId,
  is_active: overrides.mappingActive ?? true,
  is_deleted: overrides.mappingDeleted ?? false,
  permission: {
    code,
    is_active: overrides.permissionActive ?? true,
    is_deleted: overrides.permissionDeleted ?? false,
  },
});

const requestFor = (permissions: PermissionCode[], isSystemAdmin = false) => ({
  method: 'GET',
  user: {
    sub: 'user-1',
    id: 'user-1',
    email: 'user@example.com',
    areaId: 'area-1',
    roleIds: ['role-1'],
    permissions,
    isSystemAdmin,
  },
}) as unknown as FastifyRequest;

const replyRecorder = () => {
  const state: { statusCode?: number; payload?: unknown } = {};
  const reply = {
    code(statusCode: number) {
      state.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      state.payload = payload;
      return this;
    },
  } as unknown as FastifyReply;
  return { reply, state };
};

describe('Phase 2 dynamic RBAC authorization', () => {
  it('keeps the TypeScript permission catalog unique after catalog extensions', () => {
    assert.equal(new Set(PERMISSION_CODES).size, PERMISSION_CODES.length);
    assert.ok(PERMISSION_CODES.includes(PERMISSION_CODE.SUPPLY_ORDER_ALLOCATE));
  });

  it('returns HTTP 403 when a user does not have the required permission', async () => {
    const { reply, state } = replyRecorder();
    await requirePermission(PERMISSION_CODE.SUPPLY_STOCK_ADJUST)(
      requestFor([PERMISSION_CODE.SUPPLY_STOCK_READ]),
      reply,
    );
    assert.equal(state.statusCode, 403);
  });

  it('allows a user with the required permission', async () => {
    const { reply, state } = replyRecorder();
    await requirePermission(PERMISSION_CODE.SUPPLY_STOCK_ADJUST)(
      requestFor([PERMISSION_CODE.SUPPLY_STOCK_ADJUST]),
      reply,
    );
    assert.equal(state.statusCode, undefined);
  });

  it('supports allOf and anyOf without allowing an empty requirement', () => {
    const access = requestFor([
      PERMISSION_CODE.SUPPLY_ORDER_APPROVE,
      PERMISSION_CODE.SUPPLY_STOCK_ADJUST,
    ]).user;
    assert.equal(permissionRequirementSatisfied(access, {
      allOf: [
        PERMISSION_CODE.SUPPLY_ORDER_APPROVE,
        PERMISSION_CODE.SUPPLY_STOCK_ADJUST,
      ],
    }), true);
    assert.equal(permissionRequirementSatisfied(access, {
      anyOf: [
        PERMISSION_CODE.ADMIN_USER_CREATE,
        PERMISSION_CODE.SUPPLY_STOCK_ADJUST,
      ],
    }), true);
    assert.equal(permissionRequirementSatisfied(access, {}), false);
  });

  it('unions effective permissions from multiple active roles', () => {
    const roleOne = role('role-1', 'ORDER_CREATOR');
    const roleTwo = role('role-2', 'STOCK_VIEWER');
    const access = resolveEffectivePermissions(
      activeUser,
      [userRole(roleOne), userRole(roleTwo)],
      [
        rolePermission(roleOne.id, PERMISSION_CODE.SUPPLY_ORDER_CREATE),
        rolePermission(roleTwo.id, PERMISSION_CODE.SUPPLY_STOCK_READ),
      ],
    );

    assert.deepEqual(new Set(access.permissions), new Set([
      PERMISSION_CODE.SUPPLY_ORDER_CREATE,
      PERMISSION_CODE.SUPPLY_STOCK_READ,
    ]));
  });

  it('removes permissions from disabled roles and disabled permissions', () => {
    const disabledRole = role('role-1', 'DISABLED', { is_active: false });
    assert.throws(
      () => resolveEffectivePermissions(
        activeUser,
        [userRole(disabledRole)],
        [rolePermission(disabledRole.id, PERMISSION_CODE.SUPPLY_STOCK_READ)],
      ),
      (error: unknown) =>
        error instanceof AuthorizationError && error.statusCode === 403,
    );

    const activeRole = role('role-2', 'ACTIVE');
    const access = resolveEffectivePermissions(
      activeUser,
      [userRole(activeRole)],
      [rolePermission(
        activeRole.id,
        PERMISSION_CODE.SUPPLY_STOCK_READ,
        { permissionActive: false },
      )],
    );
    assert.deepEqual(access.permissions, []);
  });

  it('ignores disabled or soft-deleted N-N mappings', () => {
    const activeRole = role('role-1', 'ACTIVE');
    const disabledUserRole = userRole(activeRole, { is_active: false });
    assert.throws(
      () => resolveEffectivePermissions(
        activeUser,
        [disabledUserRole],
        [rolePermission(activeRole.id, PERMISSION_CODE.SUPPLY_STOCK_READ)],
      ),
      AuthorizationError,
    );

    const access = resolveEffectivePermissions(
      activeUser,
      [userRole(activeRole)],
      [rolePermission(
        activeRole.id,
        PERMISSION_CODE.SUPPLY_STOCK_READ,
        { mappingDeleted: true },
      )],
    );
    assert.deepEqual(access.permissions, []);
  });

  it('allows only the system ADMIN role to bypass permission checks', () => {
    const admin = role('role-1', 'ADMIN', { is_system: true });
    const adminAccess = resolveEffectivePermissions(activeUser, [userRole(admin)], []);
    assert.equal(adminAccess.isSystemAdmin, true);
    assert.equal(
      permissionRequirementSatisfied(
        adminAccess,
        PERMISSION_CODE.ADMIN_ROLE_ASSIGN_PERMISSION,
      ),
      true,
    );

    const fakeAdmin = role('role-2', 'CUSTOM_ADMIN', {
      name: 'ADMIN',
      is_system: false,
    });
    const fakeAccess = resolveEffectivePermissions(activeUser, [userRole(fakeAdmin)], []);
    assert.equal(fakeAccess.isSystemAdmin, false);
    assert.equal(
      permissionRequirementSatisfied(
        fakeAccess,
        PERMISSION_CODE.ADMIN_ROLE_ASSIGN_PERMISSION,
      ),
      false,
    );
  });

  it('uses active relation queries and request-lifecycle permission state', () => {
    const resolver = readFileSync(
      resolve(process.cwd(), 'src/services/authorization.service.ts'),
      'utf8',
    );
    const middleware = readFileSync(
      resolve(process.cwd(), 'src/middleware/auth.ts'),
      'utf8',
    );
    assert.match(resolver, /from\('user_roles'\)/);
    assert.match(resolver, /from\('role_permissions'\)/);
    assert.match(resolver, /\.eq\('role\.is_active', true\)/);
    assert.match(resolver, /\.eq\('permission\.is_active', true\)/);
    assert.match(middleware, /request\.user = \{/);
    assert.doesNotMatch(resolver, /new Map\([^)]*userId/);
  });
});

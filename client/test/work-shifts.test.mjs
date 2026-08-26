import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 8 work-shift UI', () => {
  it('loads work-shift options and assignment history through backend APIs', () => {
    const api = read('src/api/work-shifts.service.ts');
    assert.match(api, /shared\/work-shifts/);
    assert.match(api, /shared\/user-work-shift-assignments/);
    assert.doesNotMatch(api, /supabase/i);
  });

  it('uses server master data instead of hard-coded shift options', () => {
    const panel = read('src/components/users/UserWorkShiftPanel.tsx');
    assert.match(panel, /getWorkShifts/);
    assert.match(panel, /shiftsQuery\.data/);
    assert.doesNotMatch(panel, /\['S1'|'S1'\s*,\s*'S2'/);
  });

  it('shows assignment mutation only through admin.user.update capability', () => {
    const usersPage = read('src/pages/management/UsersPage.tsx');
    const panel = read('src/components/users/UserWorkShiftPanel.tsx');
    assert.match(usersPage, /hasPermission\(PERMISSION_CODE\.ADMIN_USER_UPDATE\)/);
    assert.match(usersPage, /<UserWorkShiftPanel[\s\S]*canAssign=\{canUpdate\}/);
    assert.doesNotMatch(panel, /role\s*===|role\.includes/);
  });

  it('keeps historical rows read-only and displays labels instead of raw IDs', () => {
    const panel = read('src/components/users/UserWorkShiftPanel.tsx');
    assert.match(panel, /assignment\.work_shift\.code/);
    assert.match(panel, /assignment\.work_shift\.name/);
    assert.match(panel, /displayUser\(assignment\.assigned_by_user\)/);
    assert.doesNotMatch(panel, /deleteUserWorkShift|updateUserWorkShift/);
  });
});

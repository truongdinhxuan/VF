import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Phase 11 Supply notification frontend', () => {
  it('loads persistent current-user notifications and marks only one item read', () => {
    const api = read('src/api/notifications.service.ts');
    assert.match(api, /instance\.get[\s\S]*'notifications'/);
    assert.match(api, /`notifications\/\$\{notificationId\}\/read`/);
    assert.match(api, /instance\.patch/);
    assert.doesNotMatch(api, /supabase|markAll/i);
  });

  it('uses one authenticated SSE connection with reconnect and logout cleanup', () => {
    const hook = read('src/hooks/useSupplyRealtime.ts');
    assert.match(hook, /Accept: 'text\/event-stream'/);
    assert.match(hook, /Authorization: `Bearer \$\{token\}`/);
    assert.match(hook, /controller\?\.abort\(\)/);
    assert.match(hook, /Math\.min\(retryDelay \* 2, 10_000\)/);
    assert.match(hook, /seenNotificationIds/);
    assert.doesNotMatch(hook, /EventSource|supabase\.channel|postgres_changes/);
  });

  it('invalidates targeted query families including availability without loading stock lists', () => {
    const hook = read('src/hooks/useSupplyRealtime.ts');
    assert.match(hook, /queryKeys\.notifications\.all/);
    assert.match(hook, /queryKeys\.orders\.lists/);
    assert.match(hook, /queryKeys\.orders\.detail/);
    assert.match(hook, /queryKeys\.shiftOrderSheets\.all/);
    assert.match(hook, /queryKeys\.supplyStackOptions\.all/);
    assert.match(hook, /queryKeys\.orders\.details/);
    assert.doesNotMatch(hook, /queryKeys\.(stockBalances|stockTransactions)|milkrun/i);
  });

  it('replaces the mock Header content with persistent bell UI and no mark-all action', () => {
    const header = read('src/components/workspace/Header.tsx');
    const bell = read('src/components/notifications/NotificationBell.tsx');
    assert.match(header, /<NotificationBell/);
    assert.doesNotMatch(header, /Sarah Connor|New customer signed up|Mark all as read/);
    assert.match(bell, /unread_count/);
    assert.match(bell, /aria-label=.*chưa đọc/);
    assert.match(bell, /getWorkspacePath\(role, 'orders'\)/);
  });

  it('formats notification time in Asia/Ho_Chi_Minh independently of host timezone', () => {
    const bell = read('src/components/notifications/NotificationBell.tsx');
    assert.match(bell, /timeZone: 'Asia\/Ho_Chi_Minh'/);
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(new Date('2026-08-26T23:00:00Z'));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    assert.equal(`${values.hour}:${values.minute}`, '06:00');
  });
});

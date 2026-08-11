import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/202608110008_milkrun_dashboard_rpc.sql',
);
const route = read('src/routes/milkrun/dashboard/index.ts');
const service = read('src/services/milkrun-dashboard.service.ts');

describe('Phase 10 Milkrun dashboard backend', () => {
  it('guards the endpoint and RPC with milkrun.dashboard.read', () => {
    assert.match(route, /MILKRUN_DASHBOARD_READ/);
    assert.match(route, /requirePermission/);
    assert.match(
      migration,
      /public\.has_permission\(p_actor_id, 'milkrun\.dashboard\.read'\)/i,
    );
  });

  it('calculates every DashboardIdeas metric from operational data', () => {
    for (const metric of [
      'total_trips',
      'top_shop',
      'trips_by_driver',
      'driver_shop_time',
      'trip_duration',
      'top_received_rack',
      'top_returned_rack',
      'current_stock',
      'adjustment_count',
    ]) assert.match(migration, new RegExp(`'${metric}'`, 'i'));

    assert.match(migration, /from milkrun\.trips/i);
    assert.match(migration, /join milkrun\.trip_items/i);
    assert.match(migration, /from milkrun\.stock_balances/i);
    assert.match(migration, /from milkrun\.stock_transactions/i);
    assert.match(migration, /time_lift_down - trip\.time_arrived/i);
    assert.match(migration, /trip\.time_arrived - trip\.time_start/i);
  });

  it('does not persist a dashboard aggregate', () => {
    assert.doesNotMatch(migration, /create table/i);
    assert.doesNotMatch(migration, /insert into/i);
    assert.doesNotMatch(migration, /update milkrun\./i);
    assert.match(migration, /returns jsonb/i);
  });

  it('uses one database aggregate RPC instead of JavaScript aggregation', () => {
    assert.match(service, /schema\('milkrun'\)/);
    assert.match(service, /rpc\('get_dashboard'/);
    assert.doesNotMatch(service, /\.reduce\(|\.filter\(|\.sort\(/);
  });
});


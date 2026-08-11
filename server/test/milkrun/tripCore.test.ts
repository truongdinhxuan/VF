import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read('supabase/migrations/202608110005_milkrun_trip_core.sql');
const service = read('src/services/milkrun-trips.service.ts');
const routes = read('src/routes/milkrun/trips/index.ts');

describe('Phase 7 Milkrun Trip database contract', () => {
  it('creates Trip and TripItems without Order or stock domain tables', () => {
    assert.match(migration, /create table milkrun\.trips \(/i);
    assert.match(migration, /create table milkrun\.trip_items \(/i);
    assert.match(migration, /constraint trip_items_quantity_check check \(quantity > 0\)/i);
    assert.doesNotMatch(migration, /create table [\w.]*orders?\b/i);
    assert.doesNotMatch(migration, /stock_balances|stock_transactions/i);
  });

  it('stores the required relationships and lifecycle fields', () => {
    for (const relation of [
      /trips_driver_id_fkey[\s\S]*references public\.users\(id\)/i,
      /trips_area_id_fkey[\s\S]*references public\.areas\(id\)/i,
      /trips_shop_id_fkey[\s\S]*references milkrun\.shops\(id\)/i,
      /trips_trip_type_id_fkey[\s\S]*references milkrun\.trip_types\(id\)/i,
      /trips_status_id_fkey[\s\S]*references milkrun\.trip_statuses\(id\)/i,
      /trip_items_trip_id_fkey[\s\S]*references milkrun\.trips\(id\)/i,
      /trip_items_rack_id_fkey[\s\S]*references milkrun\.racks\(id\)/i,
    ]) assert.match(migration, relation);
    assert.match(migration, /is_active boolean not null default true/i);
    assert.match(migration, /is_deleted boolean not null default false/i);
  });

  it('creates Trip and all items in one PostgreSQL RPC transaction', () => {
    assert.match(migration, /create or replace function milkrun\.create_trip/i);
    assert.match(migration, /insert into milkrun\.trips/i);
    assert.match(migration, /insert into milkrun\.trip_items/i);
    assert.match(migration, /p_actor_id/);
    assert.match(migration, /where code = 'EDC_LOGISTICS'/i);
    assert.match(migration, /where code = 'REGISTERED'/i);
  });

  it('permits only workbook Phase 7 transitions and does not implement complete', () => {
    assert.match(migration, /REGISTERED'[\s\S]*'STARTED', 'CANCELLED'/i);
    assert.match(migration, /STARTED'[\s\S]*'ARRIVED', 'CANCELLED'/i);
    assert.doesNotMatch(migration, /v_old_code = 'ARRIVED'/i);
    assert.doesNotMatch(migration, /when 'complete' then/i);
    assert.match(migration, /time_start = case when v_target_code = 'STARTED'/i);
    assert.match(migration, /time_arrived = case when v_target_code = 'ARRIVED'/i);
  });
});

describe('Phase 7 Milkrun Trip backend authorization contract', () => {
  it('registers list/detail/create/start/arrive/cancel and no complete route', () => {
    assert.equal((routes.match(/fastify\.get\(/g) ?? []).length, 2);
    assert.equal((routes.match(/fastify\.post\(/g) ?? []).length, 4);
    assert.match(routes, /\/:id\/start/);
    assert.match(routes, /\/:id\/arrive/);
    assert.match(routes, /\/:id\/cancel/);
    assert.doesNotMatch(routes, /\/:id\/complete/);
  });

  it('uses permission guards and forces read_own scope in the service', () => {
    assert.match(routes, /MILKRUN_TRIP_READ_OWN/);
    assert.match(routes, /MILKRUN_TRIP_READ_ALL/);
    assert.match(routes, /MILKRUN_TRIP_CREATE/);
    assert.match(routes, /MILKRUN_TRIP_START/);
    assert.match(routes, /MILKRUN_TRIP_ARRIVE/);
    assert.match(service, /if \(!canReadAll\(actor\)\) request = request\.eq\('driver_id', actor\.id\)/);
    assert.match(migration, /v_trip\.driver_id <> p_actor_id[\s\S]*milkrun\.trip\.read_all/i);
  });

  it('uses server pagination and resolves public relations without cross-schema embeds', () => {
    assert.match(service, /select\(TRIP_LIST_SELECT, \{ count: 'exact' \}\)/);
    assert.match(service, /request\.range\(/);
    assert.doesNotMatch(service, /driver:users!trips_driver_id_fkey/);
    assert.doesNotMatch(service, /area:areas!trips_area_id_fkey/);
    assert.match(service, /loadPublicUsersById/);
    assert.match(service, /loadPublicAreasById/);
    assert.match(service, /items:trip_items!trip_items_trip_id_fkey/);
    assert.doesNotMatch(service, /\.slice\(/);
  });
});

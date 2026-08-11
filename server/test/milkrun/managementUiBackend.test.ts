import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const tripMigration = read('supabase/migrations/202608110005_milkrun_trip_core.sql');
const tripService = read('src/services/milkrun-trips.service.ts');
const stockService = read('src/services/milkrun-stock.service.ts');
const publicRelations = read('src/services/milkrun-public-relations.service.ts');
const stockSchema = read('src/schemas/milkrun-stock.ts');

describe('Milkrun management backend relationships', () => {
  it('keeps the real UUID driver foreign key to public.users', () => {
    assert.match(tripMigration, /driver_id uuid not null/i);
    assert.match(
      tripMigration,
      /constraint trips_driver_id_fkey[\s\S]*foreign key \(driver_id\) references public\.users\(id\)/i,
    );
  });

  it('does not ask PostgREST to embed public users or areas from milkrun schema', () => {
    for (const source of [tripService, stockService]) {
      assert.doesNotMatch(source, /:users!/);
      assert.doesNotMatch(source, /:areas!/);
    }
    assert.match(tripService, /loadPublicUsersById/);
    assert.match(tripService, /loadPublicAreasById/);
    assert.match(stockService, /loadPublicUsersById/);
  });

  it('batch loads driver and creator summaries with required UI fields', () => {
    assert.match(
      publicRelations,
      /id, vinfast_id, first_name, last_name, email, avatar_url, is_active, is_deleted/,
    );
    assert.match(publicRelations, /\.in\('id', requestedIds\)/);
    assert.doesNotMatch(publicRelations, /for \([^)]*\)[\s\S]*\.from\('users'\)/);
  });

  it('supports server-side Trip filtering for immutable stock transactions', () => {
    assert.match(stockSchema, /tripId: uuid/);
    assert.match(stockService, /request = request\.eq\('trip_id', tripId\)/);
    assert.doesNotMatch(stockService, /\.slice\(/);
  });
});

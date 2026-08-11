import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Milkrun Trip frontend contract', () => {
  it('registers permission-guarded list/create/detail routes', () => {
    const routes = read('src/routes/workspace.routes.tsx');
    assert.match(routes, /path: 'milkrun\/trips'/);
    assert.match(routes, /path: 'milkrun\/trips\/create'/);
    assert.match(routes, /path: 'milkrun\/trips\/:id'/);
    assert.match(routes, /MILKRUN_TRIP_READ_OWN/);
    assert.match(routes, /MILKRUN_TRIP_READ_ALL/);
  });

  it('does not send driver_id or area_id from the create form', () => {
    const page = read('src/pages/milkrun/CreateTripPage.tsx');
    const payload = page.match(/const payload:[\s\S]*?\n    };/)?.[0] ?? '';
    assert.doesNotMatch(payload, /driver_id|area_id/);
    assert.match(payload, /shop_id/);
    assert.match(payload, /trip_type_id/);
    assert.match(payload, /items:/);
  });

  it('exposes START ARRIVE CANCEL but no COMPLETE action', () => {
    const detail = read('src/pages/milkrun/TripDetailPage.tsx');
    assert.match(detail, />START</);
    assert.match(detail, />ARRIVE</);
    assert.match(detail, />CANCEL</);
    assert.doesNotMatch(detail, />COMPLETE</);
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';
import { stockDatabaseError } from './stock.helpers';

interface IdRow { id: string }

export interface StockSearchReferences {
  supplyIds: string[];
  areaIds: string[];
  storageLocationIds: string[];
  creatorIds: string[];
}

export const resolveStockSearchReferences = async (
  db: SupabaseClient,
  search: string,
  includeCreators = false,
): Promise<StockSearchReferences> => {
  const creatorFilter = /^-?\d+$/.test(search)
    ? `first_name.ilike.*${search}*,last_name.ilike.*${search}*,vinfast_id.eq.${Number(search)}`
    : `first_name.ilike.*${search}*,last_name.ilike.*${search}*`;
  const [supplies, areas, locations, creators] = await Promise.all([
    db.from('supplies').select('id').or(
      `code.ilike.*${search}*,description.ilike.*${search}*`,
    ),
    db.from('areas').select('id').or(
      `code.ilike.*${search}*,name.ilike.*${search}*`,
    ),
    db.from('storage_locations').select('id').or(
      `code.ilike.*${search}*,name.ilike.*${search}*`,
    ),
    includeCreators
      ? db.from('users').select('id').or(creatorFilter)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const failure = [supplies, areas, locations, creators].find((result) => result.error)?.error;
  if (failure) stockDatabaseError(failure, 'Cannot resolve stock search references');
  const ids = (rows: unknown): string[] =>
    ((rows ?? []) as IdRow[]).map((row) => row.id);
  return {
    supplyIds: ids(supplies.data),
    areaIds: ids(areas.data),
    storageLocationIds: ids(locations.data),
    creatorIds: ids(creators.data),
  };
};

export const inCondition = (field: string, ids: string[]): string | null =>
  ids.length > 0 ? `${field}.in.(${ids.join(',')})` : null;

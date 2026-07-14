import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type { StorageLocationListQuery } from '../interfaces/storage-locations';
import { assertFilterId, databaseError } from './master-data.helpers';

export class StorageLocationsService {
  constructor(private readonly fastify: FastifyInstance) {}

  async list(query: StorageLocationListQuery) {
    const areaId = assertFilterId(query.area_id, 'area_id');
    let request = this.fastify.supabaseAdmin
      .from('storage_locations')
      .select('id, code, area_id, name, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (areaId) request = request.eq('area_id', areaId);
    const { data, error } = await request;
    if (error) databaseError(error, 'Cannot list storage locations');
    return data ?? [];
  }
}

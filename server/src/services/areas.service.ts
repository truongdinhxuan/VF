import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import { databaseError } from './master-data.helpers';

export class AreasService {
  constructor(private readonly fastify: FastifyInstance) {}

  async list() {
    const { data, error } = await this.fastify.supabaseAdmin
      .from('areas')
      .select('id, code, name, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) databaseError(error, 'Cannot list areas');
    return data ?? [];
  }
}

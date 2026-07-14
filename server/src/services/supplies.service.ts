import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type { RoleName } from '../domain/enums';
import { PACKING_ROLE } from '../domain/permissions';
import type { SupplyListQuery } from '../interfaces/supplies';
import { assertFilterId, databaseError, fail } from './master-data.helpers';

export const parseActiveFilter = (value: string | boolean | undefined): boolean => {
  if (value === undefined || value === '' || value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fail(400, 'is_active must be true or false');
};

export const normalizeSearchQuery = (value: string | undefined): string | null => {
  if (value === undefined || !value.trim()) return null;
  const query = value.trim();
  if (query.length > 100) fail(400, 'q must not exceed 100 characters');
  if (/[(),]/.test(query)) fail(400, 'q contains unsupported characters');
  return query.replaceAll('*', '\\*');
};

export class SuppliesService {
  constructor(private readonly fastify: FastifyInstance) {}

  async list(role: RoleName, query: SupplyListQuery) {
    const isActive = parseActiveFilter(query.is_active);
    const categoryId = assertFilterId(query.category_id, 'category_id');
    const search = normalizeSearchQuery(query.q);
    const fields = role === PACKING_ROLE
      ? 'id, code, short_text, unit_id, is_active, is_deleted'
      : [
          'id', 'code', 'short_text', 'translator_text', 'description',
          'category_id', 'unit_id', 'min_stock', 'max_stock', 'safety_stock',
          'image_url', 'is_active', 'is_deleted',
        ].join(', ');

    let request = this.fastify.supabaseAdmin
      .from('supplies')
      .select(fields)
      .eq('is_active', isActive)
      .eq('is_deleted', false)
      .order('code', { ascending: true });

    if (categoryId) request = request.eq('category_id', categoryId);
    if (search) request = request.or(`code.ilike.*${search}*,short_text.ilike.*${search}*`);

    const { data, error } = await request;
    if (error) databaseError(error, 'Cannot list supplies');
    return data ?? [];
  }
}

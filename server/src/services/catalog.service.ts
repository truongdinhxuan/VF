import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type { RoleName } from '../domain/enums';
import { PACKING_ROLE } from '../domain/permissions';
import type {
  StorageLocationListQuery,
  SupplyListQuery,
} from '../interfaces/catalog';

interface SupabaseErrorLike {
  message?: string;
}

export class CatalogServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogServiceError';
  }
}

const fail = (statusCode: number, message: string): never => {
  throw new CatalogServiceError(statusCode, message);
};

const databaseError = (error: SupabaseErrorLike | null, fallback: string): never =>
  fail(400, error?.message ?? fallback);

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

const assertFilterId = (value: string | undefined, field: string): string | null => {
  if (value === undefined || !value.trim()) return null;
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    fail(400, `${field} must be a valid UUID`);
  }
  return id;
};

export class CatalogService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async listSupplies(role: RoleName, query: SupplyListQuery) {
    const isActive = parseActiveFilter(query.is_active);
    const categoryId = assertFilterId(query.category_id, 'category_id');
    const search = normalizeSearchQuery(query.q);
    const fields = role === PACKING_ROLE
      ? 'id, code, short_text, unit_id, is_active, is_deleted'
      : [
          'id',
          'code',
          'short_text',
          'translator_text',
          'description',
          'category_id',
          'unit_id',
          'min_stock',
          'max_stock',
          'safety_stock',
          'image_url',
          'is_active',
          'is_deleted',
        ].join(', ');

    let request = this.db
      .from('supplies')
      .select(fields)
      .eq('is_active', isActive)
      .eq('is_deleted', false)
      .order('code', { ascending: true });

    if (categoryId) request = request.eq('category_id', categoryId);
    if (search) {
      request = request.or(`code.ilike.*${search}*,short_text.ilike.*${search}*`);
    }

    const { data, error } = await request;
    if (error) databaseError(error, 'Cannot list supplies');
    return data ?? [];
  }

  async listAreas() {
    const { data, error } = await this.db
      .from('areas')
      .select('id, code, name, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) databaseError(error, 'Cannot list areas');
    return data ?? [];
  }

  async listStorageLocations(query: StorageLocationListQuery) {
    const areaId = assertFilterId(query.area_id, 'area_id');
    let request = this.db
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

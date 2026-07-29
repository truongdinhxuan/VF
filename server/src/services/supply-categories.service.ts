import type { FastifyInstance } from 'fastify';
import type {
  ActiveListQuery,
  CreateSupplyCategoryBody,
  UpdateSupplyCategoryBody,
} from '../interfaces/master-data';
import {
  databaseError,
  normalizeOptionalText,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';
import { CATEGORY_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

const SELECT =
  'id, code, name, description, is_active, is_deleted, created_at, updated_at';

export class SupplyCategoriesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery = {}) {
    const active = parseActiveFilter(query.isActive ?? query.is_active);
    const pagination = parsePagination(query, {
      allowedSortBy: CATEGORY_SORT_FIELDS,
      defaultSortBy: 'code',
      defaultSortOrder: 'asc',
      legacySearch: query.q,
    });
    let request = this.db
      .from('supply_categories')
      .select(SELECT, { count: 'exact' })
      .eq('is_active', active)
      .eq('is_deleted', false);
    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,name.ilike.*${pagination.search}*,description.ilike.*${pagination.search}*`,
      );
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách loại vật tư');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from('supply_categories')
      .select(SELECT)
      .eq('id', id)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy loại vật tư');
    return data;
  }

  async create(body: CreateSupplyCategoryBody) {
    const payload = {
      code: normalizeRequiredText(body.code, 'code', 100),
      name: normalizeRequiredText(body.name, 'name'),
      description: normalizeOptionalText(body.description, 'description') ?? null,
      is_active: body.is_active ?? true,
      is_deleted: false,
    };
    const { data, error } = await this.db
      .from('supply_categories')
      .insert(payload)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Mã loại vật tư đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateSupplyCategoryBody) {
    const payload: Record<string, unknown> = {};
    if (body.code !== undefined) payload.code = normalizeRequiredText(body.code, 'code', 100);
    if (body.name !== undefined) payload.name = normalizeRequiredText(body.name, 'name');
    if (body.description !== undefined) {
      payload.description = normalizeOptionalText(body.description, 'description');
    }
    if (body.is_active !== undefined) {
      payload.is_active = body.is_active;
      if (body.is_active) payload.is_deleted = false;
    }
    const { data, error } = await this.db
      .from('supply_categories')
      .update(payload)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật loại vật tư hoặc code đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { data, error } = await this.db
      .from('supply_categories')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy loại vật tư');
    return data;
  }
}

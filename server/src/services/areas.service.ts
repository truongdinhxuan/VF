import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type {
  ActiveListQuery,
  CreateAreaBody,
  UpdateAreaBody,
} from '../interfaces/master-data';
import {
  databaseError,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';
import { AREA_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

const SELECT = 'id, code, name, is_active';

export class AreasService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery = {}) {
    const active = parseActiveFilter(query.isActive ?? query.is_active);
    const pagination = parsePagination(query, {
      allowedSortBy: AREA_SORT_FIELDS,
      defaultSortBy: 'code',
      defaultSortOrder: 'asc',
      legacySearch: query.q,
    });
    let request = this.db
      .from('areas')
      .select(SELECT, { count: 'exact' })
      .eq('is_active', active);

    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,name.ilike.*${pagination.search}*`,
      );
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Cannot list areas');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db.from('areas').select(SELECT).eq('id', id).single();
    if (error || !data) databaseError(error, 'Không tìm thấy khu vực');
    return data;
  }

  async create(body: CreateAreaBody) {
    const payload = {
      code: normalizeRequiredText(body.code, 'code', 100),
      name: normalizeRequiredText(body.name, 'name'),
      is_active: body.is_active ?? true,
    };
    const { data, error } = await this.db
      .from('areas')
      .insert(payload)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Mã khu vực đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateAreaBody) {
    const payload: Record<string, unknown> = {};
    if (body.code !== undefined) payload.code = normalizeRequiredText(body.code, 'code', 100);
    if (body.name !== undefined) payload.name = normalizeRequiredText(body.name, 'name');
    if (body.is_active !== undefined) payload.is_active = body.is_active;
    const { data, error } = await this.db
      .from('areas')
      .update(payload)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật khu vực hoặc code đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { data, error } = await this.db
      .from('areas')
      .update({ is_active: false })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy khu vực');
    return data;
  }
}

import type { FastifyInstance } from 'fastify';
import type {
  ActiveListQuery,
  CreateUnitBody,
  UpdateUnitBody,
} from '../interfaces/master-data';
import {
  databaseError,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';
import { UNIT_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

const SELECT = 'id, code, symbol, is_active, updated_at, created_at, is_deleted';

export class UnitsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery = {}) {
    const active = parseActiveFilter(query.isActive ?? query.is_active);
    const pagination = parsePagination(query, {
      allowedSortBy: UNIT_SORT_FIELDS,
      defaultSortBy: 'code',
      defaultSortOrder: 'asc',
      legacySearch: query.q,
    });
    let request = this.db
      .from('units')
      .select(SELECT, { count: 'exact' })
      .eq('is_active', active)
      .or('is_deleted.eq.false,is_deleted.is.null');
    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,symbol.ilike.*${pagination.search}*`,
      );
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách đơn vị tính');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db.from('units').select(SELECT).eq('id', id).single();
    if (error || !data) databaseError(error, 'Không tìm thấy đơn vị tính');
    return data;
  }

  async create(body: CreateUnitBody) {
    const payload = {
      code: normalizeRequiredText(body.code, 'code', 100),
      symbol: normalizeRequiredText(body.symbol, 'symbol', 100),
      is_active: body.is_active ?? true,
      is_deleted: false,
    };
    const { data, error } = await this.db
      .from('units')
      .insert(payload)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Mã đơn vị tính đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateUnitBody) {
    const payload: Record<string, unknown> = {};
    if (body.code !== undefined) payload.code = normalizeRequiredText(body.code, 'code', 100);
    if (body.symbol !== undefined) payload.symbol = normalizeRequiredText(body.symbol, 'symbol', 100);
    if (body.is_active !== undefined) {
      payload.is_active = body.is_active;
      if (body.is_active) payload.is_deleted = false;
    }
    const { data, error } = await this.db
      .from('units')
      .update(payload)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật đơn vị tính hoặc code đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { data, error } = await this.db
      .from('units')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy đơn vị tính');
    return data;
  }
}

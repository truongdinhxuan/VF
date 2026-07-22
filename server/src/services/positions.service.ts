import type { FastifyInstance } from 'fastify';
import type {
  CreatePositionBody,
  SearchListQuery,
  UpdatePositionBody,
} from '../interfaces/master-data';
import {
  databaseError,
  fail,
  normalizeRequiredText,
} from './master-data.helpers';
import { POSITION_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';

const SELECT = 'id, position_name';

export class PositionsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: SearchListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: POSITION_SORT_FIELDS,
      defaultSortBy: 'position_name',
      defaultSortOrder: 'asc',
      legacySearch: query.q,
    });
    let request = this.db.from('positions').select(SELECT, { count: 'exact' });
    if (pagination.search) {
      request = request.ilike('position_name', `%${pagination.search}%`);
    }
    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    if (pagination.sortBy !== 'id') request = request.order('id', { ascending: true });
    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách position');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db.from('positions').select(SELECT).eq('id', id).single();
    if (error || !data) databaseError(error, 'Không tìm thấy position');
    return data;
  }

  async create(body: CreatePositionBody) {
    const positionName = normalizeRequiredText(body.position_name, 'position_name');
    const { data, error } = await this.db
      .from('positions')
      .insert({ position_name: positionName })
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'position_name đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdatePositionBody) {
    const positionName = normalizeRequiredText(body.position_name ?? '', 'position_name');
    const { data, error } = await this.db
      .from('positions')
      .update({ position_name: positionName })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật position hoặc position_name đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { count, error: usageError } = await this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('position_id', id);
    if (usageError) databaseError(usageError, 'Không thể kiểm tra position đang được sử dụng');
    if ((count ?? 0) > 0) fail(409, 'Không thể xóa position đang được user sử dụng');

    const { data, error } = await this.db
      .from('positions')
      .delete()
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy position');
    return data;
  }
}

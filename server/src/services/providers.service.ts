import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type {
  CreateProviderBody,
  ProviderListQuery,
  UpdateProviderBody,
} from '../interfaces/providers';
import { PROVIDER_SORT_FIELDS } from '../schemas/master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import {
  databaseError,
  fail,
  normalizeOptionalText,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';

export const DEFAULT_PROVIDER_CODE = 'UNKNOW' as const;

const SELECT = `
  id, code, name, description, is_active, is_deleted, created_at, updated_at
`;

export const normalizeProviderCode = (value: string): string =>
  normalizeRequiredText(value, 'code', 100).toUpperCase();

interface CurrentProvider {
  id: string;
  code: string;
  is_active: boolean;
  is_deleted: boolean;
}

export class ProvidersService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  private async getCurrent(id: string): Promise<CurrentProvider> {
    const { data, error } = await this.db
      .from('providers')
      .select('id, code, is_active, is_deleted')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy Provider');
    return data as CurrentProvider;
  }

  async list(query: ProviderListQuery = {}) {
    const isActive = parseActiveFilter(query.isActive, true);
    const isDeleted = parseActiveFilter(query.isDeleted, false);
    const pagination = parsePagination(query, {
      allowedSortBy: PROVIDER_SORT_FIELDS,
      defaultSortBy: 'code',
      defaultSortOrder: 'asc',
    });

    let request = this.db
      .from('providers')
      .select(SELECT, { count: 'exact' })
      .eq('is_active', isActive)
      .eq('is_deleted', isDeleted);

    if (pagination.search) {
      request = request.or([
        `code.ilike.*${pagination.search}*`,
        `name.ilike.*${pagination.search}*`,
        `description.ilike.*${pagination.search}*`,
      ].join(','));
    }

    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(
      pagination.from,
      pagination.to,
    );
    const result = resolvePaginatedQueryResult(
      { data, error, count },
      pagination,
    );
    if (result) return result;
    if (error) databaseError(error, 'Không thể lấy danh sách Provider');
    throw new Error('Unreachable pagination state');
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from('providers')
      .select(SELECT)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy Provider');
    return data;
  }

  async create(body: CreateProviderBody) {
    const payload = {
      code: normalizeProviderCode(body.code),
      name: normalizeRequiredText(body.name, 'name'),
      description:
        normalizeOptionalText(body.description, 'description') ?? null,
      is_active: body.is_active ?? true,
      is_deleted: false,
    };

    const { data, error } = await this.db
      .from('providers')
      .insert(payload)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Provider code đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateProviderBody) {
    const current = await this.getCurrent(id);
    const payload: Record<string, unknown> = {};

    if (body.code !== undefined) {
      const code = normalizeProviderCode(body.code);
      if (current.code === DEFAULT_PROVIDER_CODE && code !== current.code) {
        fail(409, 'Không thể thay đổi code của Provider UNKNOW');
      }
      payload.code = code;
    }
    if (body.name !== undefined) {
      payload.name = normalizeRequiredText(body.name, 'name');
    }
    if (body.description !== undefined) {
      payload.description = normalizeOptionalText(
        body.description,
        'description',
      );
    }
    if (body.is_active !== undefined) {
      if (current.code === DEFAULT_PROVIDER_CODE && !body.is_active) {
        fail(409, 'Không thể deactivate Provider UNKNOW');
      }
      payload.is_active = body.is_active;
      if (body.is_active) payload.is_deleted = false;
    }
    if (Object.keys(payload).length === 0) {
      fail(400, 'Không có dữ liệu để cập nhật Provider');
    }

    const { data, error } = await this.db
      .from('providers')
      .update(payload)
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) {
      databaseError(error, 'Không thể cập nhật Provider hoặc code đã tồn tại');
    }
    return data;
  }

  async deactivate(id: string) {
    const current = await this.getCurrent(id);
    if (current.code === DEFAULT_PROVIDER_CODE) {
      fail(409, 'Không thể deactivate Provider UNKNOW');
    }

    const { data, error } = await this.db
      .from('providers')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy Provider');
    return data;
  }
}

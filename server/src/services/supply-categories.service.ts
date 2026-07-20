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
  normalizeSearchQuery,
  parseActiveFilter,
} from './master-data.helpers';

const SELECT = 'id, code, name, description, is_active';

export class SupplyCategoriesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery) {
    const active = parseActiveFilter(query.is_active);
    const search = normalizeSearchQuery(query.q);
    let request = this.db
      .from('supply_categories')
      .select(SELECT)
      .eq('is_active', active)
      .order('code');
    if (search) request = request.or(`code.ilike.*${search}*,name.ilike.*${search}*`);
    const { data, error } = await request;
    if (error) databaseError(error, 'Không thể lấy danh sách loại vật tư');
    return data ?? [];
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
    if (body.is_active !== undefined) payload.is_active = body.is_active;
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
      .update({ is_active: false })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy loại vật tư');
    return data;
  }
}

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
  normalizeSearchQuery,
  parseActiveFilter,
} from './master-data.helpers';

const SELECT = 'id, code, name, is_active';

export class AreasService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery = {}) {
    const active = parseActiveFilter(query.is_active);
    const search = normalizeSearchQuery(query.q);
    let request = this.db
      .from('areas')
      .select(SELECT)
      .eq('is_active', active)
      .order('code', { ascending: true });

    if (search) request = request.or(`code.ilike.*${search}*,name.ilike.*${search}*`);
    const { data, error } = await request;

    if (error) databaseError(error, 'Cannot list areas');
    return data ?? [];
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

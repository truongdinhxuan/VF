import type { FastifyInstance } from 'fastify';
import type {
  ActiveListQuery,
  CreateUnitBody,
  UpdateUnitBody,
} from '../interfaces/master-data';
import {
  databaseError,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeSearchQuery,
  parseActiveFilter,
} from './master-data.helpers';

const SELECT = 'id, code, symbol, name, is_active';

export class UnitsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async list(query: ActiveListQuery) {
    const active = parseActiveFilter(query.is_active);
    const search = normalizeSearchQuery(query.q);
    let request = this.db.from('units').select(SELECT).eq('is_active', active).order('code');
    if (search) request = request.or(`code.ilike.*${search}*,symbol.ilike.*${search}*,name.ilike.*${search}*`);
    const { data, error } = await request;
    if (error) databaseError(error, 'Không thể lấy danh sách đơn vị tính');
    return data ?? [];
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
      name: normalizeOptionalText(body.name, 'name', 255) ?? null,
      is_active: body.is_active ?? true,
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
    if (body.name !== undefined) payload.name = normalizeOptionalText(body.name, 'name', 255);
    if (body.is_active !== undefined) payload.is_active = body.is_active;
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
      .update({ is_active: false })
      .eq('id', id)
      .select(SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy đơn vị tính');
    return data;
  }
}

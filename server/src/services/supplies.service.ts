import type { FastifyInstance } from 'fastify';
import type {} from '../plugins/dbContext';
import type { RoleName } from '../domain/enums';
import { PACKING_ROLE } from '../domain/permissions';
import type {
  CreateSupplyBody,
  SupplyListQuery,
  UpdateSupplyBody,
} from '../interfaces/supplies';
import {
  assertFilterId,
  databaseError,
  fail,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeSearchQuery,
  parseActiveFilter,
} from './master-data.helpers';

export { normalizeSearchQuery, parseActiveFilter } from './master-data.helpers';

const RELATIONS = `
  category:supply_categories!supplies_category_id_fkey(id, code, name),
  unit:units!supplies_unit_id_fkey(id, code, symbol, name)
`;

const PACKING_SELECT = `
  id, code, short_text, category_id, unit_id, is_active, is_deleted,
  ${RELATIONS}
`;

const FULL_SELECT = `
  id, code, short_text, translator_text, description, category_id, unit_id,
  min_stock, max_stock, safety_stock, image_url, is_active, is_deleted,
  ${RELATIONS}
`;

export class SuppliesService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  private selectFor(role: RoleName): string {
    return role === PACKING_ROLE ? PACKING_SELECT : FULL_SELECT;
  }

  private async assertActiveReference(
    table: 'supply_categories' | 'units',
    id: string,
    label: string,
  ): Promise<void> {
    const { data, error } = await this.db
      .from(table)
      .select('id, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    if (error || !data) fail(400, `${label} không tồn tại hoặc không active`);
  }

  private async assertCodeCanChange(id: string, nextCode: string): Promise<void> {
    const { data: current, error } = await this.db
      .from('supplies')
      .select('code')
      .eq('id', id)
      .single();
    if (error) databaseError(error, 'Không tìm thấy vật tư');
    const currentCode = current?.code as string | undefined;
    if (!currentCode) fail(404, 'Không tìm thấy vật tư');
    if (currentCode === nextCode) return;

    const references = await Promise.all([
      this.db.from('stock_balances').select('id', { count: 'exact', head: true }).eq('supply_id', id),
      this.db.from('stock_transactions').select('id', { count: 'exact', head: true }).eq('supply_id', id),
      this.db.from('order_items').select('id', { count: 'exact', head: true }).eq('supply_id', id),
    ]);
    const referenceError = references.find((result) => result.error)?.error;
    if (referenceError) databaseError(referenceError, 'Không thể kiểm tra lịch sử sử dụng vật tư');
    if (references.some((result) => (result.count ?? 0) > 0)) {
      fail(409, 'Không thể đổi code của vật tư đã có tồn kho, giao dịch hoặc order');
    }
  }

  async list(role: RoleName, query: SupplyListQuery) {
    const isActive = parseActiveFilter(query.is_active);
    const categoryId = assertFilterId(query.category_id, 'category_id');
    const search = normalizeSearchQuery(query.q);
    const fields = this.selectFor(role);

    let request = this.db
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

  async get(role: RoleName, id: string) {
    const { data, error } = await this.db
      .from('supplies')
      .select(this.selectFor(role))
      .eq('id', id)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy vật tư');
    return data;
  }

  async create(body: CreateSupplyBody) {
    await Promise.all([
      this.assertActiveReference('supply_categories', body.category_id, 'category_id'),
      this.assertActiveReference('units', body.unit_id, 'unit_id'),
    ]);
    const payload = {
      code: normalizeRequiredText(body.code, 'code', 100),
      short_text: normalizeRequiredText(body.short_text, 'short_text'),
      translator_text: normalizeOptionalText(body.translator_text, 'translator_text') ?? null,
      description: normalizeOptionalText(body.description, 'description') ?? null,
      category_id: body.category_id,
      unit_id: body.unit_id,
      min_stock: body.min_stock ?? 0,
      max_stock: body.max_stock ?? null,
      safety_stock: body.safety_stock ?? null,
      image_url: normalizeOptionalText(body.image_url, 'image_url') ?? null,
      is_active: body.is_active ?? true,
      is_deleted: false,
    };
    const { data, error } = await this.db
      .from('supplies')
      .insert(payload)
      .select(FULL_SELECT)
      .single();
    if (error || !data) databaseError(error, 'Mã vật tư đã tồn tại');
    return data;
  }

  async update(id: string, body: UpdateSupplyBody) {
    if (body.category_id !== undefined) {
      await this.assertActiveReference('supply_categories', body.category_id, 'category_id');
    }
    if (body.unit_id !== undefined) {
      await this.assertActiveReference('units', body.unit_id, 'unit_id');
    }

    const payload: Record<string, unknown> = {};
    if (body.code !== undefined) {
      const code = normalizeRequiredText(body.code, 'code', 100);
      await this.assertCodeCanChange(id, code);
      payload.code = code;
    }
    if (body.short_text !== undefined) {
      payload.short_text = normalizeRequiredText(body.short_text, 'short_text');
    }
    for (const field of ['translator_text', 'description', 'image_url'] as const) {
      if (body[field] !== undefined) {
        payload[field] = normalizeOptionalText(body[field], field);
      }
    }
    for (const field of [
      'category_id', 'unit_id', 'min_stock', 'max_stock', 'safety_stock',
    ] as const) {
      if (body[field] !== undefined) payload[field] = body[field];
    }
    if (body.is_active !== undefined) {
      payload.is_active = body.is_active;
      if (body.is_active) payload.is_deleted = false;
    }

    const { data, error } = await this.db
      .from('supplies')
      .update(payload)
      .eq('id', id)
      .select(FULL_SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không thể cập nhật vật tư hoặc code đã tồn tại');
    return data;
  }

  async remove(id: string) {
    const { data, error } = await this.db
      .from('supplies')
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(FULL_SELECT)
      .single();
    if (error || !data) databaseError(error, 'Không tìm thấy vật tư');
    return data;
  }
}

import type { FastifyInstance } from 'fastify';
import { PERMISSION_CODE } from '../domain/permission-codes';
import type { ShiftOrderSheetListQuery } from '../interfaces/shift-order-sheets';
import { SHIFT_ORDER_SHEET_SORT_FIELDS } from '../schemas/shift-order-sheets';
import { hasPermission } from './authorization.service';
import type { OrderActor } from './orders.service';
import {
  createShiftOrderSheetExportFilename,
  createShiftOrderSheetWorkbook,
  ShiftOrderSheetExportError,
  type ShiftOrderSheetExportItem,
  type ShiftOrderSheetExportOrder,
  type ShiftOrderSheetExportSource,
} from './shift-order-sheet-exporter';
import {
  createPaginatedResult,
  parsePagination,
  resolvePaginatedQueryResult,
} from '../utils/pagination';

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

interface EmbeddedShift {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
}

interface SheetRow {
  id: string;
  area_id: string;
  work_shift_id: string;
  work_date: string;
  leader_id: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  area: unknown;
  work_shift: EmbeddedShift | EmbeddedShift[] | null;
  leader: unknown;
  orders?: Array<{
    id: string;
    created_at?: string;
    is_deleted?: boolean;
    [key: string]: unknown;
  }>;
}

interface ExportRelation {
  code: string;
  name?: string;
  description?: string | null;
}

interface ExportItemRow {
  id: string;
  created_at: string;
  quantity_requested: number | string;
  quantity_issued: number | string | null;
  set_per_qty: number | string | null;
  requested_stack_quantity: number | string | null;
  note: string | null;
  is_deleted: boolean;
  supply: unknown;
  provider: unknown;
}

interface ExportOrderRow {
  id: string;
  code: string;
  submitted_at: string | null;
  issued_at: string | null;
  note: string | null;
  is_deleted: boolean;
  order_items?: ExportItemRow[];
}

interface ExportSheetRow extends Omit<SheetRow, 'orders'> {
  orders: ExportOrderRow[];
}

export class ShiftOrderSheetServiceError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'ShiftOrderSheetServiceError';
  }
}

const fail = (statusCode: number, message: string): never => {
  throw new ShiftOrderSheetServiceError(statusCode, message);
};

const databaseError = (error: SupabaseErrorLike | null, fallback: string): never => {
  if (error?.code === 'PGRST116') fail(404, 'Không tìm thấy Phiếu Order Ca');
  return fail(400, error?.message ?? fallback);
};

const firstRelation = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const shiftBounds = (workDate: string, shift: EmbeddedShift | null) => {
  if (!shift) return { shift_start_at: '', shift_end_at: '' };
  const startDate = new Date(`${workDate}T${shift.start_time}+07:00`);
  const endDate = new Date(`${workDate}T${shift.end_time}+07:00`);
  if (shift.crosses_midnight) endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    shift_start_at: startDate.toISOString(),
    shift_end_at: endDate.toISOString(),
  };
};

const SHEET_BASE_SELECT = `
  id, area_id, work_shift_id, work_date, leader_id,
  is_active, is_deleted, created_at, updated_at,
  area:areas!supply_shift_order_sheets_area_id_fkey(id, code, name),
  work_shift:work_shifts!supply_shift_order_sheets_work_shift_id_fkey(
    id, code, name, start_time, end_time, crosses_midnight
  ),
  leader:users!supply_shift_order_sheets_leader_id_fkey(
    id, vinfast_id, email, first_name, last_name
  )
`;

const SHEET_LIST_SELECT = `
  ${SHEET_BASE_SELECT},
  orders:orders!orders_shift_order_sheet_id_fkey(id)
`;

const SHEET_DETAIL_SELECT = `
  ${SHEET_BASE_SELECT},
  orders:orders!orders_shift_order_sheet_id_fkey(
    id, code, from_area_id, to_area_id, requested_by, status_id, note,
    submitted_at, approved_at, issued_at, received_at, completed_at,
    created_at, updated_at, is_active, is_deleted,
    status_lookup:order_statuses!orders_status_id_fkey(id, code, name),
    requester:users!orders_requested_by_fkey(
      id, vinfast_id, email, first_name, last_name
    ),
    from_area:areas!orders_from_area_id_fkey(id, code, name),
    to_area:areas!orders_to_area_id_fkey(id, code, name),
    order_items(id)
  )
`;

const SHEET_EXPORT_SELECT = `
  ${SHEET_BASE_SELECT},
  orders:orders!orders_shift_order_sheet_id_fkey(
    id, code, submitted_at, issued_at, note, is_deleted,
    order_items(
      id, created_at, quantity_requested, quantity_issued,
      set_per_qty, requested_stack_quantity, note, is_deleted,
      supply:supplies!order_items_supply_id_fkey(
        id, code, description,
        category:supply_categories!supplies_category_id_fkey(id, code)
      ),
      provider:providers!order_items_provider_id_fkey(id, code, name)
    )
  )
`;

export class ShiftOrderSheetsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  private isAreaScoped(actor: OrderActor): boolean {
    return !actor.isSystemAdmin
      && hasPermission(actor, PERMISSION_CODE.SUPPLY_ORDER_CREATE)
      && !hasPermission(actor, PERMISSION_CODE.SUPPLY_ORDER_APPROVE)
      && !hasPermission(actor, PERMISSION_CODE.SUPPLY_ORDER_ALLOCATE)
      && !hasPermission(actor, PERMISSION_CODE.SUPPLY_ORDER_ISSUE);
  }

  private normalize(row: SheetRow) {
    const shift = firstRelation(row.work_shift);
    return {
      ...row,
      area: firstRelation(row.area as object | object[] | null),
      work_shift: shift,
      leader: firstRelation(row.leader as object | object[] | null),
      ...shiftBounds(row.work_date, shift),
      order_count: (row.orders ?? []).length,
      business_time_zone: BUSINESS_TIME_ZONE,
    };
  }

  private assertReadable(actor: OrderActor, row: Pick<SheetRow, 'area_id'>): void {
    if (this.isAreaScoped(actor) && row.area_id !== actor.areaId) {
      fail(403, 'Phiếu Order Ca nằm ngoài phạm vi Area của bạn');
    }
  }

  async list(actor: OrderActor, query: ShiftOrderSheetListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: SHIFT_ORDER_SHEET_SORT_FIELDS,
      defaultSortBy: 'work_date',
      defaultSortOrder: 'desc',
    });

    let searchFilter: string | null = null;
    if (pagination.search) {
      const term = pagination.search;
      const [areaResult, shiftResult, leaderResult] = await Promise.all([
        this.db
          .from('areas')
          .select('id')
          .eq('is_deleted', false)
          .or(`code.ilike.*${term}*,name.ilike.*${term}*`),
        this.db
          .from('work_shifts')
          .select('id')
          .eq('is_deleted', false)
          .or(`code.ilike.*${term}*,name.ilike.*${term}*`),
        this.db
          .from('users')
          .select('id')
          .eq('is_deleted', false)
          .or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`),
      ]);
      if (areaResult.error || shiftResult.error || leaderResult.error) {
        databaseError(
          areaResult.error ?? shiftResult.error ?? leaderResult.error,
          'Không thể tìm Phiếu Order Ca',
        );
      }
      const parts: string[] = [];
      const areaIds = (areaResult.data ?? []).map((row) => row.id);
      const shiftIds = (shiftResult.data ?? []).map((row) => row.id);
      const leaderIds = (leaderResult.data ?? []).map((row) => row.id);
      if (areaIds.length) parts.push(`area_id.in.(${areaIds.join(',')})`);
      if (shiftIds.length) parts.push(`work_shift_id.in.(${shiftIds.join(',')})`);
      if (leaderIds.length) parts.push(`leader_id.in.(${leaderIds.join(',')})`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(term)) parts.push(`work_date.eq.${term}`);
      if (parts.length === 0) return createPaginatedResult([], pagination, 0);
      searchFilter = parts.join(',');
    }

    let request = this.db
      .from('supply_shift_order_sheets')
      .select(SHEET_LIST_SELECT, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('orders.is_deleted', false);

    if (searchFilter) request = request.or(searchFilter);

    if (this.isAreaScoped(actor)) request = request.eq('area_id', actor.areaId);
    if (query.workDate) request = request.eq('work_date', query.workDate);
    if (query.workShiftId) request = request.eq('work_shift_id', query.workShiftId);
    if (query.leaderId) request = request.eq('leader_id', query.leaderId);
    if (query.areaId) {
      if (this.isAreaScoped(actor) && query.areaId !== actor.areaId) {
        fail(403, 'Phiếu Order Ca nằm ngoài phạm vi Area của bạn');
      }
      request = request.eq('area_id', query.areaId);
    }

    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(pagination.from, pagination.to);
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (!result) {
      if (error) databaseError(error, 'Không thể tải Phiếu Order Ca');
      throw new Error('Unreachable pagination state');
    }
    return {
      ...result,
      items: result.items.map((row) => this.normalize(row as SheetRow)),
    };
  }

  async get(actor: OrderActor, sheetId: string) {
    const { data, error } = await this.db
      .from('supply_shift_order_sheets')
      .select(SHEET_DETAIL_SELECT)
      .eq('id', sheetId)
      .eq('is_deleted', false)
      .eq('orders.is_deleted', false)
      .single();

    if (error || !data) databaseError(error, 'Không thể tải Phiếu Order Ca');
    const row = data as unknown as SheetRow & { orders: Array<Record<string, unknown>> };
    this.assertReadable(actor, row);

    const normalized = this.normalize(row);
    return {
      ...normalized,
      orders: (row.orders ?? [])
        .filter((order) => !order.is_deleted)
        .map((order) => ({
          ...order,
          status_lookup: firstRelation(
            (order.status_lookup ?? null) as object | object[] | null,
          ),
          requester: firstRelation(
            (order.requester ?? null) as object | object[] | null,
          ),
          from_area: firstRelation(
            (order.from_area ?? null) as object | object[] | null,
          ),
          to_area: firstRelation(
            (order.to_area ?? null) as object | object[] | null,
          ),
        }))
      .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at))),
    };
  }

  async export(actor: OrderActor, sheetId: string) {
    const { data, error } = await this.db
      .from('supply_shift_order_sheets')
      .select(SHEET_EXPORT_SELECT)
      .eq('id', sheetId)
      .eq('is_deleted', false)
      .single();

    if (error || !data) databaseError(error, 'Không thể tải Phiếu Order Ca để xuất Excel');
    const row = data as unknown as ExportSheetRow;
    this.assertReadable(actor, row);

    const source: ShiftOrderSheetExportSource = {
      id: row.id,
      work_date: row.work_date,
      area: firstRelation(row.area as ExportRelation | ExportRelation[] | null) as {
        code: string;
        name: string;
      } | null,
      work_shift: firstRelation(row.work_shift) as {
        code: string;
        name: string;
      } | null,
      orders: (row.orders ?? [])
        .filter((order) => !order.is_deleted)
        .map((order): ShiftOrderSheetExportOrder => ({
          id: order.id,
          code: order.code,
          submitted_at: order.submitted_at,
          issued_at: order.issued_at,
          note: order.note,
          is_deleted: order.is_deleted,
          order_items: (order.order_items ?? [])
            .filter((item) => !item.is_deleted)
            .map((item): ShiftOrderSheetExportItem => {
              const supply = firstRelation(item.supply as (ExportRelation & {
                category: unknown;
              }) | Array<ExportRelation & { category: unknown }> | null);
              const provider = firstRelation(
                item.provider as ExportRelation | ExportRelation[] | null,
              );
              const category = supply
                ? firstRelation(supply.category as ExportRelation | ExportRelation[] | null)
                : null;
              return {
                id: item.id,
                created_at: item.created_at,
                quantity_requested: item.quantity_requested,
                quantity_issued: item.quantity_issued,
                set_per_qty: item.set_per_qty,
                requested_stack_quantity: item.requested_stack_quantity,
                note: item.note,
                supply: supply ? {
                  code: supply.code,
                  description: supply.description ?? null,
                  category: category ? { code: category.code } : null,
                } : null,
                provider: provider ? {
                  code: provider.code,
                  name: provider.name ?? '',
                } : null,
              };
            }),
        })),
    };

    try {
      return {
        buffer: await createShiftOrderSheetWorkbook(source),
        fileName: createShiftOrderSheetExportFilename(source),
      };
    } catch (error) {
      if (error instanceof ShiftOrderSheetExportError) {
        fail(422, error.message);
      }
      throw error;
    }
  }
}

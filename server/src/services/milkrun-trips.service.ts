import type { FastifyInstance } from 'fastify';
import { PERMISSION_CODE } from '../domain/permission-codes';
import type {
  CancelMilkrunTripBody,
  CreateMilkrunTripBody,
  MilkrunTripActor,
  MilkrunTripListQuery,
} from '../interfaces/milkrun-trips';
import type {} from '../plugins/dbContext';
import { MILKRUN_TRIP_SORT_FIELDS } from '../schemas/milkrun-trips';
import {
  assertFilterId,
  databaseError,
  fail,
  normalizeOptionalText,
} from './master-data.helpers';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import {
  loadPublicAreasById,
  loadPublicUsersById,
  type MilkrunPublicAreaSummary,
  type MilkrunPublicUserSummary,
} from './milkrun-public-relations.service';

const TRIP_LIST_SELECT = `
  id, code, driver_id, area_id, shop_id, trip_type_id, status_id,
  time_start, time_arrived, time_lift_up, time_lift_down,
  attachment_url, note, is_active, is_deleted, created_at, updated_at,
  shop:shops!trips_shop_id_fkey(id, code, name),
  trip_type:trip_types!trips_trip_type_id_fkey(id, code, name),
  status:trip_statuses!trips_status_id_fkey!inner(id, code, name, sort_order)
`;

const TRIP_DETAIL_SELECT = `
  ${TRIP_LIST_SELECT},
  items:trip_items!trip_items_trip_id_fkey(
    id, trip_id, rack_id, quantity, note,
    is_active, is_deleted, created_at, updated_at,
    rack:racks!trip_items_rack_id_fkey(id, code, name, image_url)
  )
`;

const canReadAll = (actor: MilkrunTripActor): boolean =>
  actor.isSystemAdmin
  || actor.permissions.includes(PERMISSION_CODE.MILKRUN_TRIP_READ_ALL);

const normalizeStatusCode = (value: string | undefined): string | null => {
  if (value === undefined || !value.trim()) return null;
  const status = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*$/.test(status)) fail(400, 'status không hợp lệ');
  return status;
};

const classifyRpcError = (message: string): never => {
  if (/permission denied|ownership denied/i.test(message)) fail(403, message);
  if (/not found/i.test(message)) fail(404, message);
  if (/invalid milkrun trip action/i.test(message)) fail(409, message);
  return databaseError({ message }, 'Không thể xử lý Milkrun Trip');
};

export class MilkrunTripService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin.schema('milkrun');
  }

  private async attachPublicRelations<T extends {
    driver_id: string;
    area_id: string;
  }>(rows: T[]): Promise<Array<T & {
    driver: MilkrunPublicUserSummary | null;
    area: MilkrunPublicAreaSummary | null;
  }>> {
    const [drivers, areas] = await Promise.all([
      loadPublicUsersById(this.fastify, rows.map((row) => row.driver_id)),
      loadPublicAreasById(this.fastify, rows.map((row) => row.area_id)),
    ]);
    return rows.map((row) => ({
      ...row,
      driver: drivers.get(row.driver_id) ?? null,
      area: areas.get(row.area_id) ?? null,
    }));
  }

  async list(actor: MilkrunTripActor, query: MilkrunTripListQuery = {}) {
    const pagination = parsePagination(query, {
      allowedSortBy: MILKRUN_TRIP_SORT_FIELDS,
      defaultSortBy: 'created_at',
      defaultSortOrder: 'desc',
    });
    const statusId = assertFilterId(query.statusId, 'statusId');
    const shopId = assertFilterId(query.shopId, 'shopId');
    const tripTypeId = assertFilterId(query.tripTypeId, 'tripTypeId');
    const driverId = assertFilterId(query.driverId, 'driverId');
    const status = normalizeStatusCode(query.status);

    let request = this.db
      .from('trips')
      .select(TRIP_LIST_SELECT, { count: 'exact' })
      .eq('is_deleted', false);

    if (!canReadAll(actor)) request = request.eq('driver_id', actor.id);
    else if (driverId) request = request.eq('driver_id', driverId);
    if (statusId) request = request.eq('status_id', statusId);
    if (shopId) request = request.eq('shop_id', shopId);
    if (tripTypeId) request = request.eq('trip_type_id', tripTypeId);
    if (status) request = request.eq('status.code', status);
    if (query.dateFrom) request = request.gte('created_at', query.dateFrom);
    if (query.dateTo) request = request.lte('created_at', query.dateTo);
    if (pagination.search) {
      request = request.or(
        `code.ilike.*${pagination.search}*,note.ilike.*${pagination.search}*`,
      );
    }

    request = request.order(pagination.sortBy, {
      ascending: pagination.sortOrder === 'asc',
    });
    request = request.order('id', { ascending: true });

    const { data, error, count } = await request.range(
      pagination.from,
      pagination.to,
    );
    const result = resolvePaginatedQueryResult({ data, error, count }, pagination);
    if (result) {
      return {
        ...result,
        items: await this.attachPublicRelations(result.items as Array<{
          driver_id: string;
          area_id: string;
        }>),
      };
    }
    databaseError(error, 'Không thể tải danh sách Milkrun Trip');
  }

  async get(actor: MilkrunTripActor, id: string) {
    let request = this.db
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_deleted', false);
    if (!canReadAll(actor)) request = request.eq('driver_id', actor.id);

    const { data, error } = await request.maybeSingle();
    if (error) databaseError(error, 'Không thể tải Milkrun Trip');
    if (!data) fail(404, 'Không tìm thấy Trip hoặc bạn không có quyền xem');
    return (await this.attachPublicRelations([data as unknown as {
      driver_id: string;
      area_id: string;
    }]))[0];
  }

  async create(actor: MilkrunTripActor, body: CreateMilkrunTripBody) {
    const items = body.items.map((item) => ({
      rack_id: item.rack_id,
      quantity: item.quantity,
      note: normalizeOptionalText(item.note, 'item.note'),
    }));
    const { data: tripId, error } = await this.db.rpc('create_trip', {
      p_actor_id: actor.id,
      p_shop_id: body.shop_id,
      p_trip_type_id: body.trip_type_id,
      p_attachment_url: normalizeOptionalText(body.attachment_url, 'attachment_url') ?? null,
      p_note: normalizeOptionalText(body.note, 'note') ?? null,
      p_items: items,
    });
    if (error || !tripId) classifyRpcError(error?.message ?? 'Trip create failed');
    return this.get(actor, tripId as string);
  }

  private async transition(
    actor: MilkrunTripActor,
    id: string,
    action: 'start' | 'arrive' | 'cancel',
    reason?: string | null,
  ) {
    const { data: tripId, error } = await this.db.rpc('transition_trip', {
      p_actor_id: actor.id,
      p_trip_id: id,
      p_action: action,
      p_reason: normalizeOptionalText(reason, 'reason') ?? null,
    });
    if (error || !tripId) classifyRpcError(error?.message ?? 'Trip transition failed');
    return this.get(actor, tripId as string);
  }

  start(actor: MilkrunTripActor, id: string) {
    return this.transition(actor, id, 'start');
  }

  arrive(actor: MilkrunTripActor, id: string) {
    return this.transition(actor, id, 'arrive');
  }

  cancel(actor: MilkrunTripActor, id: string, body: CancelMilkrunTripBody = {}) {
    return this.transition(actor, id, 'cancel', body.reason);
  }
}

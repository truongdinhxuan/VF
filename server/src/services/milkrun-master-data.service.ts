import type { FastifyInstance } from 'fastify';
import {
  MILKRUN_STOCK_TRANSACTION_TYPE_CODE,
  MILKRUN_TRIP_STATUS_CODE,
} from '../domain/milkrun-codes';
import type {
  MilkrunMasterBody,
  MilkrunMasterListQuery,
  MilkrunMasterResource,
  MilkrunMasterUpdateBody,
} from '../interfaces/milkrun-master-data';
import type {} from '../plugins/dbContext';
import {
  MILKRUN_ADJUSTMENT_REASON_SORT_FIELDS,
  MILKRUN_RACK_SORT_FIELDS,
  MILKRUN_SHOP_SORT_FIELDS,
  MILKRUN_STOCK_TRANSACTION_TYPE_SORT_FIELDS,
  MILKRUN_TRIP_STATUS_SORT_FIELDS,
  MILKRUN_TRIP_TYPE_SORT_FIELDS,
  MILKRUN_VEHICLE_SORT_FIELDS,
} from '../schemas/milkrun-master-data';
import { parsePagination, resolvePaginatedQueryResult } from '../utils/pagination';
import {
  databaseError,
  fail,
  normalizeOptionalText,
  normalizeRequiredText,
  parseActiveFilter,
} from './master-data.helpers';
import { loadPublicUsersById } from './milkrun-public-relations.service';

interface ResourceDefinition {
  table: MilkrunMasterResource;
  select: string;
  searchFields: readonly string[];
  sortFields: readonly string[];
  defaultSortBy: string;
  systemProtected?: boolean;
}

const DEFINITIONS: Record<MilkrunMasterResource, ResourceDefinition> = {
  racks: {
    table: 'racks',
    select: 'id, code, name, image_url, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name'],
    sortFields: MILKRUN_RACK_SORT_FIELDS,
    defaultSortBy: 'code',
  },
  shops: {
    table: 'shops',
    select: 'id, code, name, description, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name', 'description'],
    sortFields: MILKRUN_SHOP_SORT_FIELDS,
    defaultSortBy: 'code',
  },
  trip_types: {
    table: 'trip_types',
    select: 'id, code, name, description, is_system, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name', 'description'],
    sortFields: MILKRUN_TRIP_TYPE_SORT_FIELDS,
    defaultSortBy: 'code',
    systemProtected: true,
  },
  trip_statuses: {
    table: 'trip_statuses',
    select: 'id, code, name, description, sort_order, is_system, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name', 'description'],
    sortFields: MILKRUN_TRIP_STATUS_SORT_FIELDS,
    defaultSortBy: 'sort_order',
    systemProtected: true,
  },
  vehicles: {
    table: 'vehicles',
    select: 'id, code, plate_number, driver_id, name, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'plate_number', 'name'],
    sortFields: MILKRUN_VEHICLE_SORT_FIELDS,
    defaultSortBy: 'code',
  },
  stock_transaction_types: {
    table: 'stock_transaction_types',
    select: 'id, code, name, effect, requires_reason, is_system, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name', 'effect'],
    sortFields: MILKRUN_STOCK_TRANSACTION_TYPE_SORT_FIELDS,
    defaultSortBy: 'code',
    systemProtected: true,
  },
  adjustment_reasons: {
    table: 'adjustment_reasons',
    select: 'id, code, name, description, is_active, is_deleted, created_at, updated_at',
    searchFields: ['code', 'name', 'description'],
    sortFields: MILKRUN_ADJUSTMENT_REASON_SORT_FIELDS,
    defaultSortBy: 'code',
  },
};

const TRIP_STATUS_CODES = new Set(Object.values(MILKRUN_TRIP_STATUS_CODE));
const STOCK_TRANSACTION_TYPE_CODES = new Set(
  Object.values(MILKRUN_STOCK_TRANSACTION_TYPE_CODE),
);

export const normalizeMilkrunCode = (value: string): string =>
  normalizeRequiredText(value, 'code', 100).toUpperCase();

interface CurrentRow {
  id: string;
  code: string;
  is_system?: boolean;
}

export class MilkrunMasterDataService {
  private readonly definition: ResourceDefinition;

  constructor(
    private readonly fastify: FastifyInstance,
    resource: MilkrunMasterResource,
  ) {
    this.definition = DEFINITIONS[resource];
  }

  private get db() {
    return this.fastify.supabaseAdmin.schema('milkrun');
  }

  private get resource() {
    return this.definition.table;
  }

  private async attachPublicRelations<T extends Record<string, unknown>>(
    rows: T[],
  ): Promise<T[]> {
    if (this.resource !== 'vehicles') return rows;
    const users = await loadPublicUsersById(
      this.fastify,
      rows.map((row) => row.driver_id as string | null | undefined),
    );
    return rows.map((row) => ({
      ...row,
      driver: typeof row.driver_id === 'string'
        ? users.get(row.driver_id) ?? null
        : null,
    }));
  }

  private uniqueMessage(): string {
    if (this.resource === 'vehicles') {
      return 'Code, biển số hoặc driver đã được gán cho xe khác';
    }
    return `Code ${this.resource} đã tồn tại`;
  }

  private async getCurrent(id: string): Promise<CurrentRow> {
    const columns = this.definition.systemProtected
      ? 'id, code, is_system'
      : 'id, code';
    const { data, error } = await this.db
      .from(this.resource)
      .select(columns)
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error || !data) databaseError(error, `Không tìm thấy ${this.resource}`);
    return data as unknown as CurrentRow;
  }

  private validateAllowedCode(code: string): void {
    if (this.resource === 'trip_statuses' && !TRIP_STATUS_CODES.has(
      code as (typeof MILKRUN_TRIP_STATUS_CODE)[keyof typeof MILKRUN_TRIP_STATUS_CODE],
    )) {
      fail(400, 'TripStatus code không thuộc StatusFlow đã chốt');
    }
    if (
      this.resource === 'stock_transaction_types'
      && !STOCK_TRANSACTION_TYPE_CODES.has(
        code as (typeof MILKRUN_STOCK_TRANSACTION_TYPE_CODE)[keyof typeof MILKRUN_STOCK_TRANSACTION_TYPE_CODE],
      )
    ) {
      fail(400, 'StockTransactionType code không thuộc danh sách hệ thống đã chốt');
    }
  }

  private async validateDriver(driverId: string | null | undefined): Promise<void> {
    if (!driverId) return;
    const { data, error } = await this.fastify.supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', driverId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error) databaseError(error, 'Không thể xác minh driver');
    if (!data) fail(400, 'driver_id không tồn tại hoặc không hoạt động');
  }

  private async buildPayload(
    body: MilkrunMasterBody | MilkrunMasterUpdateBody,
    isCreate: boolean,
  ): Promise<Record<string, unknown>> {
    const input = body as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if (input.code !== undefined) {
      const normalizedCode = normalizeMilkrunCode(input.code as string);
      this.validateAllowedCode(normalizedCode);
      payload.code = normalizedCode;
    }
    if (input.name !== undefined) {
      payload.name = normalizeRequiredText(input.name as string, 'name');
    }
    if (input.description !== undefined) {
      payload.description = normalizeOptionalText(
        input.description as string | null,
        'description',
      );
    }
    if (input.image_url !== undefined) {
      payload.image_url = normalizeOptionalText(
        input.image_url as string | null,
        'image_url',
      );
    }
    if (input.plate_number !== undefined) {
      payload.plate_number = normalizeRequiredText(
        input.plate_number as string,
        'plate_number',
        100,
      ).toUpperCase();
    }
    if (input.driver_id !== undefined) {
      const driverId = input.driver_id as string | null;
      await this.validateDriver(driverId);
      payload.driver_id = driverId;
    }
    if (input.sort_order !== undefined) payload.sort_order = input.sort_order;
    if (input.effect !== undefined) payload.effect = input.effect;
    if (input.requires_reason !== undefined) {
      payload.requires_reason = input.requires_reason;
    }
    if (input.is_active !== undefined) {
      payload.is_active = input.is_active;
      if (input.is_active === true) payload.is_deleted = false;
    }

    if (isCreate) {
      payload.is_active = input.is_active ?? true;
      payload.is_deleted = false;
      if (this.definition.systemProtected) payload.is_system = false;
    }

    return payload;
  }

  async list(query: MilkrunMasterListQuery = {}) {
    const isActive = parseActiveFilter(query.isActive, true);
    const isDeleted = parseActiveFilter(query.isDeleted, false);
    const pagination = parsePagination(query, {
      allowedSortBy: this.definition.sortFields,
      defaultSortBy: this.definition.defaultSortBy,
      defaultSortOrder: 'asc',
    });

    let request = this.db
      .from(this.resource)
      .select(this.definition.select, { count: 'exact' })
      .eq('is_active', isActive)
      .eq('is_deleted', isDeleted);

    if (pagination.search) {
      request = request.or(this.definition.searchFields
        .map((field) => `${field}.ilike.*${pagination.search}*`)
        .join(','));
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
    if (result) {
      return {
        ...result,
        items: await this.attachPublicRelations(
          result.items as unknown as Array<Record<string, unknown>>,
        ),
      };
    }
    databaseError(error, `Không thể lấy danh sách ${this.resource}`);
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from(this.resource)
      .select(this.definition.select)
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error || !data) databaseError(error, `Không tìm thấy ${this.resource}`);
    return (await this.attachPublicRelations([
      data as unknown as Record<string, unknown>,
    ]))[0];
  }

  async create(body: MilkrunMasterBody) {
    const payload = await this.buildPayload(body, true);
    const { data, error } = await this.db
      .from(this.resource)
      .insert(payload)
      .select(this.definition.select)
      .single();
    if (error || !data) databaseError(error, this.uniqueMessage());
    return (await this.attachPublicRelations([
      data as unknown as Record<string, unknown>,
    ]))[0];
  }

  async update(
    id: string,
    body: MilkrunMasterUpdateBody,
    actorId?: string,
  ) {
    const current = await this.getCurrent(id);
    const payload = await this.buildPayload(body, false);
    if (Object.keys(payload).length === 0) {
      fail(400, `Không có dữ liệu để cập nhật ${this.resource}`);
    }
    if (current.is_system) {
      if (payload.code !== undefined && payload.code !== current.code) {
        fail(409, 'Không thể thay đổi code hệ thống');
      }
      if (payload.is_active === false || payload.is_deleted === true) {
        fail(409, 'Không thể deactivate bản ghi hệ thống');
      }
    }

    if (this.resource === 'vehicles' && 'driver_id' in payload) {
      if (!actorId) fail(401, 'Thiếu thông tin người thực hiện gán xe');
      const driverId = payload.driver_id as string | null;
      delete payload.driver_id;
      const { error } = await this.db.rpc('assign_vehicle_driver', {
        p_actor_id: actorId,
        p_vehicle_id: id,
        p_driver_id: driverId,
      });
      if (error) {
        if (/permission denied/i.test(error.message)) fail(403, error.message);
        if (/unavailable/i.test(error.message)) fail(404, error.message);
        databaseError(error, 'Không thể gán hoặc đổi xe cho driver');
      }
      if (Object.keys(payload).length === 0) return this.get(id);
    }

    const { data, error } = await this.db
      .from(this.resource)
      .update(payload)
      .eq('id', id)
      .select(this.definition.select)
      .single();
    if (error || !data) databaseError(error, this.uniqueMessage());
    return (await this.attachPublicRelations([
      data as unknown as Record<string, unknown>,
    ]))[0];
  }

  async deactivate(id: string) {
    const current = await this.getCurrent(id);
    if (current.is_system) {
      fail(409, 'Không thể deactivate bản ghi hệ thống');
    }
    const { data, error } = await this.db
      .from(this.resource)
      .update({ is_active: false, is_deleted: true })
      .eq('id', id)
      .select(this.definition.select)
      .single();
    if (error || !data) databaseError(error, `Không tìm thấy ${this.resource}`);
    return (await this.attachPublicRelations([
      data as unknown as Record<string, unknown>,
    ]))[0];
  }
}

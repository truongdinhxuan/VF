import type { FastifyInstance } from 'fastify';
import type { MilkrunDashboardQuery } from '../interfaces/milkrun-dashboard';
import type {} from '../plugins/dbContext';
import { assertFilterId, fail } from './master-data.helpers';

export class MilkrunDashboardService {
  constructor(private readonly fastify: FastifyInstance) {}

  async get(actorId: string, query: MilkrunDashboardQuery = {}) {
    const driverId = assertFilterId(query.driverId, 'driverId');
    const shopId = assertFilterId(query.shopId, 'shopId');
    const statusId = assertFilterId(query.statusId, 'statusId');
    const { data, error } = await this.fastify.supabaseAdmin
      .schema('milkrun')
      .rpc('get_dashboard', {
        p_actor_id: actorId,
        p_date_from: query.dateFrom ?? null,
        p_date_to: query.dateTo ?? null,
        p_driver_id: driverId,
        p_shop_id: shopId,
        p_status_id: statusId,
      });

    if (error) {
      if (/permission denied/i.test(error.message)) fail(403, error.message);
      fail(400, error.message || 'Không thể tải Dashboard Milkrun');
    }
    return data;
  }
}


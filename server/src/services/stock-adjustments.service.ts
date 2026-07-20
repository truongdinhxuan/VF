import type { FastifyInstance } from 'fastify';
import {
  assertPositiveStockQuantity,
  assertStockAdjustmentType,
  normalizeStockReason,
  StockRuleError,
} from '../domain/stockRules';
import type {
  CreateStockAdjustmentBody,
  StockActor,
} from '../interfaces/stock';
import { StockServiceError, stockRpcError } from './stock.helpers';

export class StockAdjustmentsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async create(actor: StockActor, body: CreateStockAdjustmentBody) {
    let quantity: number;
    let reason: string;
    let type: CreateStockAdjustmentBody['type'];
    try {
      quantity = assertPositiveStockQuantity(body.quantity);
      reason = normalizeStockReason(body.reason);
      type = assertStockAdjustmentType(body.type);
    } catch (error) {
      if (error instanceof StockRuleError) {
        throw new StockServiceError(400, error.message);
      }
      throw error;
    }

    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    const { data, error } = await this.db.rpc('apply_stock_adjustment', {
      p_supply_id: body.supply_id,
      p_area_id: body.area_id,
      p_storage_location_id: body.storage_location_id,
      p_type: type,
      p_quantity: quantity,
      p_reason: reason,
      p_note: note,
      p_created_by: actor.id,
    });
    if (error) stockRpcError(error);
    return data;
  }
}

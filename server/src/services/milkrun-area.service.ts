import type { FastifyInstance } from 'fastify';
import type { AreaRecord } from '../interfaces/database';
import type {} from '../plugins/dbContext';

export const MILKRUN_AREA_CODE = 'EDC_LOGISTICS' as const;

const MILKRUN_AREA_SELECT =
  'id, code, name, description, is_active, is_deleted, created_at, updated_at';

export class MilkrunAreaValidationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'MilkrunAreaValidationError';
  }
}

export class MilkrunAreaService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async getActiveArea(): Promise<AreaRecord> {
    const { data, error } = await this.db
      .from('areas')
      .select(MILKRUN_AREA_SELECT)
      .eq('code', MILKRUN_AREA_CODE)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      throw new MilkrunAreaValidationError(
        500,
        'Không thể xác minh Area dùng chung của Milkrun',
      );
    }
    if (!data) {
      throw new MilkrunAreaValidationError(
        503,
        `Area ${MILKRUN_AREA_CODE} chưa được cấu hình hoặc không hoạt động`,
      );
    }

    return data as AreaRecord;
  }

  async assertAreaId(areaId: string): Promise<AreaRecord> {
    const area = await this.getActiveArea();
    if (area.id !== areaId) {
      throw new MilkrunAreaValidationError(
        400,
        `Milkrun chỉ được sử dụng Area ${MILKRUN_AREA_CODE}`,
      );
    }
    return area;
  }
}

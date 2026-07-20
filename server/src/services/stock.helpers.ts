interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

export class StockServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'StockServiceError';
  }
}

export const stockFail = (statusCode: number, message: string): never => {
  throw new StockServiceError(statusCode, message);
};

export const stockDatabaseError = (
  error: SupabaseErrorLike | null,
  fallback: string,
): never => {
  if (error?.code === 'PGRST116') return stockFail(404, fallback);
  if (error?.code === '23505') return stockFail(409, 'Stock balance already exists');
  if (error?.code === '23503') {
    return stockFail(409, 'Referenced stock data does not exist');
  }
  return stockFail(400, error?.message ?? fallback);
};

export const stockRpcError = (error: SupabaseErrorLike): never => {
  const message = error.message ?? 'Cannot adjust stock';
  if (/not found|inactive|outside area/i.test(message)) return stockFail(400, message);
  if (/not allowed/i.test(message)) return stockFail(403, message);
  if (/insufficient/i.test(message)) return stockFail(409, message);
  if (/quantity|reason|type/i.test(message)) return stockFail(400, message);
  return stockFail(400, message);
};

export const parseOptionalBoolean = (
  value: string | boolean | undefined,
  field: string,
): boolean | null => {
  if (value === undefined || value === '') return null;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return stockFail(400, `${field} must be true or false`);
};

export const normalizeDateBoundary = (
  value: string | undefined,
  field: string,
  endOfDay = false,
): string | null => {
  if (value === undefined || !value.trim()) return null;
  const normalized = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const candidate = dateOnly
    ? `${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : normalized;
  const timestamp = Date.parse(candidate);
  if (Number.isNaN(timestamp)) stockFail(400, `${field} must be a valid date`);
  return new Date(timestamp).toISOString();
};

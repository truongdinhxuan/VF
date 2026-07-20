interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

export class MasterDataServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'MasterDataServiceError';
  }
}

export const fail = (statusCode: number, message: string): never => {
  throw new MasterDataServiceError(statusCode, message);
};

export const databaseError = (
  error: SupabaseErrorLike | null,
  fallback: string,
): never => {
  if (error?.code === '23505') fail(409, fallback);
  if (error?.code === '23503') {
    fail(409, 'Không thể thay đổi dữ liệu vì đang được bảng khác sử dụng');
  }
  if (error?.code === 'PGRST116') fail(404, fallback);
  return fail(400, error?.message ?? fallback);
};

export const assertFilterId = (
  value: string | undefined,
  field: string,
): string | null => {
  if (value === undefined || !value.trim()) return null;
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    fail(400, `${field} must be a valid UUID`);
  }
  return id;
};

export const parseActiveFilter = (
  value: string | boolean | undefined,
  defaultValue = true,
): boolean => {
  if (value === undefined || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fail(400, 'is_active phải là true hoặc false');
};

export const normalizeSearchQuery = (value: string | undefined): string | null => {
  if (value === undefined || !value.trim()) return null;
  const query = value.trim();
  if (query.length > 100) fail(400, 'q không được vượt quá 100 ký tự');
  if (/[(),]/.test(query)) fail(400, 'q chứa ký tự không được hỗ trợ');
  return query.replaceAll('*', '\\*');
};

export const normalizeRequiredText = (
  value: string,
  field: string,
  maxLength = 255,
): string => {
  const normalized = value.trim();
  if (!normalized) fail(400, `${field} không được để trống`);
  if (normalized.length > maxLength) {
    fail(400, `${field} không được vượt quá ${maxLength} ký tự`);
  }
  return normalized;
};

export const normalizeOptionalText = (
  value: string | null | undefined,
  field: string,
  maxLength = 2000,
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    fail(400, `${field} không được vượt quá ${maxLength} ký tự`);
  }
  return normalized || null;
};

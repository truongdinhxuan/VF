interface SupabaseErrorLike {
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
): never => fail(400, error?.message ?? fallback);

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

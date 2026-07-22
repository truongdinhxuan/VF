import type { ApiEnvelope } from '../types/api';

export const unwrapData = <T>(response: ApiEnvelope<T>): T => response.data;

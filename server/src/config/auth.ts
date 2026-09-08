import type { CookieSerializeOptions } from '@fastify/cookie';

const DEFAULT_ACCESS_TTL = '30m';
const DEFAULT_REFRESH_TTL_DAYS = 30;
const DEFAULT_COOKIE_NAME = 'vf_refresh_token';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean auth environment values must be true or false');
};

const parseRefreshTtlDays = (): number => {
  const value = Number(process.env.APP_REFRESH_TOKEN_TTL_DAYS ?? DEFAULT_REFRESH_TTL_DAYS);
  if (!Number.isInteger(value) || value < 1 || value > 90) {
    throw new Error('APP_REFRESH_TOKEN_TTL_DAYS must be an integer from 1 to 90');
  }
  return value;
};

const parseSameSite = (
  value: string | undefined,
  secure: boolean,
): CookieSerializeOptions['sameSite'] => {
  const normalized = value?.trim().toLowerCase();
  const sameSite = normalized || (secure ? 'none' : 'lax');
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('APP_REFRESH_COOKIE_SAME_SITE must be lax, strict or none');
  }
  if (sameSite === 'none' && !secure) {
    throw new Error('SameSite=None refresh cookies require APP_REFRESH_COOKIE_SECURE=true');
  }
  return sameSite as 'lax' | 'strict' | 'none';
};

const normalizeOrigin = (value: string): string => {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`Invalid configured client origin: ${value}`);
  }
  return parsed.origin;
};

export const getAllowedClientOrigins = (): string[] => {
  const configured = [
    process.env.ORIGIN_URL ?? '',
    ...(process.env.CLIENT_ORIGINS ?? '').split(','),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  return [...new Set(configured)];
};

export const isAllowedClientOrigin = (origin: string | undefined): boolean => {
  if (!origin) return false;
  return getAllowedClientOrigins().includes(origin);
};

export interface AuthConfiguration {
  accessTokenTtl: string;
  issuer: string;
  audience: string;
  refreshTokenTtlSeconds: number;
  refreshCookieName: string;
  refreshCookieOptions: CookieSerializeOptions;
}

export const getAuthConfiguration = (): AuthConfiguration => {
  const production = process.env.NODE_ENV === 'production';
  const secure = parseBoolean(process.env.APP_REFRESH_COOKIE_SECURE, production);
  const refreshTokenTtlSeconds = parseRefreshTtlDays() * 24 * 60 * 60;
  const domain = process.env.APP_REFRESH_COOKIE_DOMAIN?.trim() || undefined;

  return {
    accessTokenTtl: process.env.APP_JWT_ACCESS_TTL?.trim() || DEFAULT_ACCESS_TTL,
    issuer: process.env.APP_JWT_ISSUER?.trim() || 'vf-api',
    audience: process.env.APP_JWT_AUDIENCE?.trim() || 'vf-client',
    refreshTokenTtlSeconds,
    refreshCookieName: process.env.APP_REFRESH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME,
    refreshCookieOptions: {
      httpOnly: true,
      secure,
      sameSite: parseSameSite(process.env.APP_REFRESH_COOKIE_SAME_SITE, secure),
      path: '/auth',
      maxAge: refreshTokenTtlSeconds,
      ...(domain ? { domain } : {}),
    },
  };
};

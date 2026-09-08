import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthConfiguration, isAllowedClientOrigin } from '../config/auth';

const REFRESH_SECRET_BYTES = 32;
const SESSION_TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43,})$/i;

interface SessionRotationRow {
  session_id: string;
  user_id: string;
  expires_at: string;
  rotation_counter: number;
}

export interface CreatedAuthSession {
  sessionId: string;
  userId: string;
  refreshToken: string;
  expiresAt: string;
}

export class AuthSessionError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthSessionError';
  }
}

const sessionFailure = (statusCode: number, message: string): never => {
  throw new AuthSessionError(statusCode, message);
};

const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const createRefreshToken = (sessionId: string): string =>
  `${sessionId}.${randomBytes(REFRESH_SECRET_BYTES).toString('base64url')}`;

const parseRefreshToken = (
  token: string | undefined,
): { sessionId: string; tokenHash: string } | null => {
  if (!token) return null;
  const match = SESSION_TOKEN_PATTERN.exec(token);
  if (!match) return null;
  return { sessionId: match[1], tokenHash: hashRefreshToken(token) };
};

export const requireTrustedAuthOrigin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!isAllowedClientOrigin(request.headers.origin)) {
    return reply.code(403).send({ error: 'Origin không được phép thực hiện thao tác phiên' });
  }
};

export class AuthSessionsService {
  constructor(private readonly fastify: FastifyInstance) {}

  private get db() {
    return this.fastify.supabaseAdmin;
  }

  async create(
    userId: string,
    metadata: { userAgent?: string; ipAddress?: string },
  ): Promise<CreatedAuthSession> {
    const config = getAuthConfiguration();
    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    const expiresAt = new Date(
      Date.now() + config.refreshTokenTtlSeconds * 1000,
    ).toISOString();

    const { error } = await this.db.from('auth_sessions').insert({
      id: sessionId,
      user_id: userId,
      refresh_token_hash: hashRefreshToken(refreshToken),
      expires_at: expiresAt,
      user_agent: metadata.userAgent?.slice(0, 1000) || null,
      ip_address: metadata.ipAddress?.slice(0, 255) || null,
    });
    if (error) {
      this.fastify.log.error({ err: error }, 'Unable to create auth session');
      return sessionFailure(500, 'Không thể tạo phiên đăng nhập');
    }

    return { sessionId, userId, refreshToken, expiresAt };
  }

  async rotate(rawToken: string | undefined): Promise<CreatedAuthSession> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return sessionFailure(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');

    const refreshToken = createRefreshToken(parsed.sessionId);
    const usedAt = new Date().toISOString();
    const { data, error } = await this.db.rpc('rotate_auth_session', {
      p_session_id: parsed.sessionId,
      p_old_refresh_token_hash: parsed.tokenHash,
      p_new_refresh_token_hash: hashRefreshToken(refreshToken),
      p_used_at: usedAt,
    });

    if (error) {
      this.fastify.log.error({ err: error }, 'Unable to rotate auth session');
      return sessionFailure(500, 'Không thể làm mới phiên đăng nhập');
    }
    const row = Array.isArray(data)
      ? data[0] as SessionRotationRow | undefined
      : data as SessionRotationRow | null;
    if (!row) return sessionFailure(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      refreshToken,
      expiresAt: row.expires_at,
    };
  }

  async revokeCurrent(rawToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return;

    const { error } = await this.db
      .from('auth_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', parsed.sessionId)
      .eq('refresh_token_hash', parsed.tokenHash)
      .is('revoked_at', null);
    if (error) {
      this.fastify.log.error({ err: error }, 'Unable to revoke current auth session');
      return sessionFailure(500, 'Không thể đóng phiên đăng nhập');
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const { error } = await this.db
      .from('auth_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (error) {
      this.fastify.log.error({ err: error }, 'Unable to revoke user auth sessions');
      return sessionFailure(500, 'Không thể thu hồi phiên đăng nhập người dùng');
    }
  }
}

export const getRefreshCookie = (request: FastifyRequest): string | undefined => {
  const config = getAuthConfiguration();
  return request.cookies[config.refreshCookieName];
};

export const setRefreshCookie = (
  reply: FastifyReply,
  token: string,
  expiresAt: string,
): void => {
  const config = getAuthConfiguration();
  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  reply.setCookie(config.refreshCookieName, token, {
    ...config.refreshCookieOptions,
    maxAge: remainingSeconds,
    expires: new Date(expiresAt),
  });
};

export const clearRefreshCookie = (reply: FastifyReply): void => {
  const config = getAuthConfiguration();
  const { maxAge: _maxAge, ...options } = config.refreshCookieOptions;
  reply.clearCookie(config.refreshCookieName, options);
};

export const authSessionMetadata = (
  request: FastifyRequest,
): { userAgent?: string; ipAddress?: string } => ({
  userAgent: request.headers['user-agent'],
  ipAddress: request.ip,
});

export const __authSessionInternals = {
  createRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
};

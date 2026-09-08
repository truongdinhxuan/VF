import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const createSessionAuth = async (userIds) => {
  const secret = process.env.APP_JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(secret && supabaseUrl && serviceRoleKey);

  const database = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sessions = new Map();
  const rows = [...new Set(userIds)].map((userId) => {
    const id = randomUUID();
    sessions.set(userId, id);
    return {
      id,
      user_id: userId,
      refresh_token_hash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
  });
  const { error } = await database.from('auth_sessions').insert(rows);
  assert.equal(error, null, error?.message);

  const tokenFor = (subject, expiresInSeconds = 300) => {
    const sid = sessions.get(subject);
    assert.ok(sid, `Missing auth session for ${subject}`);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const payload = encode({
      sub: subject,
      sid,
      iat: now,
      exp: now + expiresInSeconds,
      iss: process.env.APP_JWT_ISSUER ?? 'vf-api',
      aud: process.env.APP_JWT_AUDIENCE ?? 'vf-client',
    });
    const signature = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    return `${header}.${payload}.${signature}`;
  };

  return {
    tokenFor,
    auth: (subject) => ({ authorization: `Bearer ${tokenFor(subject)}` }),
    cleanup: async () => {
      const { error: cleanupError } = await database
        .from('auth_sessions')
        .delete()
        .in('id', [...sessions.values()]);
      assert.equal(cleanupError, null, cleanupError?.message);
    },
  };
};


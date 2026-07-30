import { createClient } from '@supabase/supabase-js';
import { ROLE_CODE } from '../domain/enums';
import {
  hashPassword,
  isStrongPassword,
  PASSWORD_RULE_MESSAGE,
} from '../utils/password';

interface AdminRoleRelation {
  code: string;
}

interface BootstrapAdmin {
  id: string;
  vinfast_id: number;
  is_active: boolean;
  is_verified: boolean;
  is_deleted: boolean;
  role: AdminRoleRelation | AdminRoleRelation[] | null;
}

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async () => {
  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const vinfastIdText = requiredEnvironment('BOOTSTRAP_ADMIN_VINFAST_ID');
  const password = requiredEnvironment('BOOTSTRAP_ADMIN_PASSWORD');
  const vinfastId = Number(vinfastIdText);

  if (!Number.isInteger(vinfastId)) {
    throw new Error('BOOTSTRAP_ADMIN_VINFAST_ID must be an integer');
  }
  if (!isStrongPassword(password)) {
    throw new Error(PASSWORD_RULE_MESSAGE);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await db
    .from('users')
    .select(
      'id, vinfast_id, is_active, is_verified, is_deleted, role:roles!users_role_id_fkey(code)',
    )
    .eq('vinfast_id', vinfastId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Admin user was not found');
  }

  const admin = data as unknown as BootstrapAdmin;
  const role = Array.isArray(admin.role) ? admin.role[0] : admin.role;
  if (role?.code !== ROLE_CODE.ADMIN) {
    throw new Error('The selected user does not have the ADMIN role');
  }
  if (!admin.is_active || !admin.is_verified || admin.is_deleted) {
    throw new Error(
      'Admin must be active, verified, and not soft-deleted before bootstrapping',
    );
  }

  const passwordHash = await hashPassword(password);
  const { error: credentialError } = await db
    .from('user_credentials')
    .upsert(
      {
        user_id: admin.id,
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (credentialError) throw new Error(credentialError.message);

  process.stdout.write(
    `Internal credential configured for ADMIN VinFast ID ${admin.vinfast_id}.\n`,
  );
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Bootstrap failed: ${message}\n`);
  process.exitCode = 1;
});

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logout } from "../api/auth.service";
import { refreshAccessSession } from "../api/http";
import {
  notifyAuthenticationLost,
  removeLegacyStoredAccessToken,
  setAccessToken,
  setAuthenticationLostHandler,
  subscribeAccessToken,
} from "../api/auth-token";
import { resolveRoleCode, type RoleCode } from "../constants/roles";
import { queryClient } from "../lib/queryClient";
import type { AuthSessionResponse, IUser } from "../types/users";
import {
  hasAllPermissionsInSet,
  hasAnyPermissionInSet,
  hasPermissionInSet,
  type PermissionInput,
} from "../constants/permissions";

interface AuthContextType {
  user: IUser | null;
  role: RoleCode | null;
  permissions: readonly string[];
  isSystemAdmin: boolean;
  hasPermission: (permission: PermissionInput) => boolean;
  hasAnyPermission: (permissions: readonly PermissionInput[]) => boolean;
  hasAllPermissions: (permissions: readonly PermissionInput[]) => boolean;
  loading: boolean;
  accessToken: string | null;
  loginContext: (session: AuthSessionResponse) => void;
  logoutContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearClientSession = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    removeLegacyStoredAccessToken();
    let isActive = true;
    const unsubscribe = subscribeAccessToken((token) => {
      if (isActive) setAccessTokenState(token);
    });
    setAuthenticationLostHandler(() => {
      if (isActive) clearClientSession();
    });

    void refreshAccessSession()
      .then((session) => {
        if (isActive) setUser(session);
      })
      .catch(() => {
        if (isActive) clearClientSession();
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe();
      setAuthenticationLostHandler(null);
    };
  }, [clearClientSession]);

  const loginContext = (session: AuthSessionResponse) => {
    queryClient.clear();
    setAccessToken(session.accessToken);
    setUser(session);
    setLoading(false);
  };

  const logoutContext = async () => {
    try {
      await logout();
    } finally {
      notifyAuthenticationLost();
      removeLegacyStoredAccessToken();
    }
  };
  const role = resolveRoleCode(user?.publicData.role);
  const permissions = useMemo(() => user?.permissions ?? [], [user?.permissions]);
  const isSystemAdmin = user?.isSystemAdmin === true;
  const hasPermission = useCallback(
    (permission: PermissionInput) => hasPermissionInSet(permissions, permission, isSystemAdmin),
    [isSystemAdmin, permissions],
  );
  const hasAnyPermission = useCallback(
    (required: readonly PermissionInput[]) => hasAnyPermissionInSet(permissions, required, isSystemAdmin),
    [isSystemAdmin, permissions],
  );
  const hasAllPermissions = useCallback(
    (required: readonly PermissionInput[]) => hasAllPermissionsInSet(permissions, required, isSystemAdmin),
    [isSystemAdmin, permissions],
  );

  return (
    <AuthContext.Provider value={{
      user, role, permissions, isSystemAdmin,
      hasPermission, hasAnyPermission, hasAllPermissions,
      loading, accessToken: accessTokenState, loginContext, logoutContext,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được đặt trong AuthProvider");
  return context;
};

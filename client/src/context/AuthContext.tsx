/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMyProfile } from "../api/users.service";
import { resolveRoleCode, type RoleCode } from "../constants/roles";
import { queryClient } from "../lib/queryClient";
import type { IUser } from "../types/users";

interface AuthContextType {
  user: IUser | null;
  role: RoleCode | null;
  loading: boolean;
  loginContext: (token: string) => Promise<void>;
  logoutContext: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("access_token")));

  const fetchUser = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profile = await getMyProfile();
      setUser(profile);
    } catch (error) {
      console.error("Token không hợp lệ hoặc đã hết hạn:", error);
      localStorage.removeItem("access_token");
      queryClient.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return;
    }

    let isActive = true;
    void getMyProfile()
      .then((profile) => {
        if (isActive) setUser(profile);
      })
      .catch((error: unknown) => {
        console.error("Token không hợp lệ hoặc đã hết hạn:", error);
        localStorage.removeItem("access_token");
        queryClient.clear();
        if (isActive) setUser(null);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const loginContext = async (token: string) => {
    queryClient.clear();
    localStorage.setItem("access_token", token);
    setLoading(true);
    await fetchUser();
  };

  const logoutContext = () => {
    localStorage.removeItem("access_token");
    queryClient.clear();
    setUser(null);
  };

  const role = resolveRoleCode(user?.publicData.role);

  return (
    <AuthContext.Provider value={{ user, role, loading, loginContext, logoutContext }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được đặt trong AuthProvider");
  return context;
};

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMyProfile } from "../api/user.service";
import { resolveRoleName, type RoleName } from "../constants/roles";
import type { IUser } from "../interfaces";

interface AuthContextType {
  user: IUser | null;
  role: RoleName | null;
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

    try {
      setUser(await getMyProfile());
    } catch (error) {
      console.error("Token không hợp lệ hoặc đã hết hạn:", error);
      localStorage.removeItem("access_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    let isActive = true;
    getMyProfile()
      .then((profile) => {
        if (isActive) setUser(profile);
      })
      .catch((error: unknown) => {
        console.error("Token không hợp lệ hoặc đã hết hạn:", error);
        localStorage.removeItem("access_token");
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
    localStorage.setItem("access_token", token);
    setLoading(true);
    await fetchUser();
  };

  const logoutContext = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  const role = resolveRoleName(user?.publicData.role);

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

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type IUser } from "../interfaces";
import { getProfile } from "../api/user.service";

interface AuthContextType {
  user: IUser | null;
  loading: boolean;
  loginContext: (token: string) => Promise<void>;
  logoutContext: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Trạng thái chờ load thông tin user ban đầu

  // Hàm đồng bộ thông tin User từ API khi có Token
  const fetchUser = async () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const userData = await getProfile();
        setUser(userData);
      } catch (error) {
        console.error("Token không hợp lệ hoặc hết hạn:", error);
        // localStorage.removeItem("access_token");
        setUser(null);
      }
    }
    setLoading(false);
  };
  // Chạy 1 lần duy nhất khi ứng dụng khởi chạy (hoặc khi F5 trang)
  useEffect(() => {
    fetchUser();
  }, []);

  // Gọi hàm này ngay sau khi bấm nút Đăng nhập thành công ở LoginPage
  const loginContext = async (token: string) => {
    localStorage.setItem("access_token", token);
    setLoading(true);
    await fetchUser(); // Gọi API lấy thông tin user ngay lập tức
  };

  const logoutContext = () => {
    localStorage.removeItem("access_token");
    setUser(null);  
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginContext, logoutContext }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook ngắn gọn để sử dụng Context ở các Component khác
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được đặt trong AuthProvider");
  return context;
};
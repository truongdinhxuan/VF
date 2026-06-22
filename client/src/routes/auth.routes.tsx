import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

// Chỉ nạp trang đăng nhập khi truy cập /auth/login
const LoginPage = lazy(() => 
  import("../pages/auth/LoginPage").then(m => ({ default: m.LoginPage }))
);

export const authRoutes: RouteObject = {
  path: "auth",
  children: [
    { path: "login", element: <LoginPage /> }
  ]
};
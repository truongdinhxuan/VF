import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { RefreshResponse } from '../types/users';
import {
  getAccessToken,
  notifyAuthenticationLost,
  setAccessToken,
} from './auth-token';
import { createSingleFlight } from './single-flight';

const apiBaseUrl = import.meta.env.VITE_API_URL;

// 1. Khởi tạo instance của Axios
const instance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true,
});

const sessionClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true,
});

export const refreshAccessSession = createSingleFlight(
  (): Promise<RefreshResponse> => sessionClient
      .post<RefreshResponse>('auth/refresh')
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .catch((error: unknown) => {
        notifyAuthenticationLost();
        throw error;
      })
);

interface RetriedRequestConfig extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

const isSessionEndpoint = (url: string | undefined): boolean => {
  const normalized = url?.replace(/^\/+/, '') ?? '';
  return ['auth/login', 'auth/refresh', 'auth/logout'].some(
    (path) => normalized.startsWith(path),
  );
};

// 2. TẠO REQUEST INTERCEPTOR (Đây là mấu chốt giải quyết lỗi 401)
instance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    
    // Nếu có token, tự động đính kèm vào Header Authorization theo chuẩn Bearer
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. (Tùy chọn) TẠO RESPONSE INTERCEPTOR để xử lý lỗi văng ra login
instance.interceptors.response.use(
  (response) => response.config.responseType === 'blob'
    ? response
    : response.data, // Binary download cần giữ headers; JSON giữ contract data hiện tại.
  async (error: AxiosError) => {
    const config = error.config as RetriedRequestConfig | undefined;
    if (error.response?.status === 401
        && config
        && !config._authRetry
        && !isSessionEndpoint(config.url)) {
      config._authRetry = true;
      try {
        const refreshed = await refreshAccessSession();
        config.headers.Authorization = `Bearer ${refreshed.accessToken}`;
        return instance.request(config);
      } catch {
        // The shared refresh path already cleared in-memory authentication.
      }
    }
    return Promise.reject(error);
  }
);

export default instance;

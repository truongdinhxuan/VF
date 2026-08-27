import axios from 'axios';

// 1. Khởi tạo instance của Axios
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Đường dẫn tới Backend Fastify của bạn
  timeout: 10000,
});

// 2. TẠO REQUEST INTERCEPTOR (Đây là mấu chốt giải quyết lỗi 401)
instance.interceptors.request.use(
  (config) => {
    // Lấy token từ Local Storage
    const token = localStorage.getItem('access_token');
    
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
  (error) => {
    // Nếu Backend báo lỗi 401 (Hết hạn hoặc sai token)
    if (error.response && error.response.status === 401) {
      console.warn("Token hết hạn, đang đăng xuất...");
      localStorage.removeItem('access_token');
      
      // Đá người dùng về trang login (Dùng window.location vì ở ngoài phạm vi của React Router)
      // window.location.href = '/auth/login'; 
    }
    return Promise.reject(error);
  }
);

export default instance;

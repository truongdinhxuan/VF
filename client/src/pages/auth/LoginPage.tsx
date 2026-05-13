import { useState } from "react";
import { login } from "../../api/auth.service"; // Điều chỉnh đường dẫn cho đúng code của bạn
import { useNavigate } from "react-router-dom";

export const LoginPage = () => {
  // 1. Khai báo state để lưu trữ dữ liệu nhập vào
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // 2. Hàm xử lý khi nhấn nút Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trang web load lại
    
    try {
      console.log("Đang gửi dữ liệu:", { email, password });
      const response = await login({ email, password });
      
      console.log("Đăng nhập thành công:", response);
      alert("Đăng nhập thành công!");
      
      // Chuyển hướng sau khi thành công (ví dụ về trang chủ)
      navigate("/"); 
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert("Đăng nhập thất bại, kiểm tra lại console!");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Login Test</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <br />
        <div>
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};
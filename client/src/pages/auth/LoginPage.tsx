import { login } from "../../api/auth.service"; // Điều chỉnh đường dẫn cho đúng code của bạn
import { useNavigate } from "react-router-dom";
import {useForm} from "react-hook-form"
import { useAuth } from "../../context/AuthContext";
import { resolveRoleCode } from "../../constants/roles";
import { getApiErrorMessage } from "../../api/errors";
import { getButtonClassName } from "../../components/common/Button";
import { getRoleHomePath } from "../../constants/workspaces";
interface ILoginFormInput {
  vinfast_id: number;
  password: string;
}

export const LoginPage = () => {
  const { loginContext } = useAuth();
  const navigate = useNavigate();

  // Declare hook form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ILoginFormInput>({
    defaultValues: {
      vinfast_id: 0,
      password: "",
    },
  });
  // Hàm xử lý sự kiện submit form khi đã qua kiểm tra hợp lệ
  const onSubmit = async (data: ILoginFormInput) => {
    const { vinfast_id, password } = data;
    
    if (!Number.isInteger(vinfast_id) || !password) return;

    try {
      const response = await login({ vinfast_id, password });
      
      if (response.token) {
        // loginContext lưu token vào local storage
        await loginContext(response.token); 
      }

      // Phân luồng điều hướng dựa theo Role
      const userRole = resolveRoleCode(response.publicData?.role);
      navigate(getRoleHomePath(userRole));
      
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert(getApiErrorMessage(error, "Đăng nhập thất bại, vui lòng kiểm tra lại thông tin!"));
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-slate-800">
            <span className="text-blue-600">Login</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập để tiếp tục truy cập hệ thống
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nhập VinFast ID */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              VinFast ID
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Nhập VinFast ID"
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2
                ${errors.vinfast_id
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"}`}
              {...register("vinfast_id", {
                valueAsNumber: true,
                required: "VinFast ID là trường bắt buộc",
                validate: (value) =>
                  Number.isInteger(value) || "VinFast ID phải là số nguyên",
              })}
            />
            {errors.vinfast_id && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">
                {errors.vinfast_id.message}
              </p>
            )}
          </div>

          {/* Nhập Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2
                ${errors.password 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"}`}
              {...register("password", {
                required: "Mật khẩu là trường bắt buộc nhập",
                minLength: {
                  value: 9,
                  message: "Mật khẩu phải chứa ít nhất 9 ký tự"
                }
              })}
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={getButtonClassName({
              variant: "info",
              size: "lg",
              block: true,
              className: "rounded-xl active:scale-[0.98]",
            })}
          >
            {/* After ? = true After : false */}
            {isSubmitting ? "Đang xử lý..." : "Đăng Nhập"}
          </button>
        </form>

        {/* Footer */}
        {/* <div className="mt-6 rounded-lg bg-blue-50/50 p-3 text-xs text-blue-700">
          <p className="font-semibold">Mẹo chạy thử trên Preview:</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>Nhập email có chữ <span className="font-bold">"admin"</span> để tự động chuyển hướng về trang <span className="font-bold">/admin</span>.</li>
            <li>Nhập email bất kỳ khác để chuyển hướng về trang <span className="font-bold">/milkrun</span>.</li>
          </ul>
        </div> */}
      </div>
    </div>
  );
};

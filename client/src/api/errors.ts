import axios from "axios";

interface ErrorResponse<TDetails = unknown> {
  error?: string;
  message?: string;
  code?: string;
  details?: TDetails;
}

const businessErrorMessages: Record<string, string> = {
  STACK_ALLOCATIONS_NOT_CONFIRMED:
    "Cần xác nhận thực tế cho tất cả vị trí phân bổ trước khi xuất hàng.",
  STACK_ISSUE_ALLOCATION_INCOMPLETE:
    "Tổng số chồng thực tế chưa bằng số chồng đã duyệt.",
  STACK_APPROVAL_NOT_COMPATIBLE:
    "Số lượng đã duyệt không tương thích với quy cách SET/chồng.",
  STACK_PARTIAL_ISSUE_NOT_SUPPORTED:
    "Kiện sắt tiêu chuẩn chưa hỗ trợ cấp hàng một phần.",
  STACK_ISSUE_STOCK_CONFLICT:
    "Tồn thực tế tại vị trí đã xác nhận không còn đủ để cấp hàng.",
  ORDER_ALREADY_ISSUED:
    "Order đã được cấp hàng; không thể trừ tồn lần nữa.",
  ORDER_NOT_ISSUABLE:
    "Order không ở trạng thái có thể cấp hàng.",
  INSUFFICIENT_STACK_STOCK:
    "Không đủ số chồng tồn kho để phân bổ.",
  ACTUAL_STACK_EXCEEDS_EXPECTED:
    "Số chồng thực tế không được vượt số chồng dự kiến.",
};

const technicalErrorPattern = /SQLSTATE|PostgREST|PGRST\d+|duplicate key|violates .* constraint|relation .* does not exist|function .* does not exist/i;

const resolveBusinessErrorMessage = (
  response: ErrorResponse | undefined,
  fallback: string,
): string => {
  const rawMessage = response?.error ?? response?.message;
  const code = response?.code ?? rawMessage;
  if (code && businessErrorMessages[code]) return businessErrorMessages[code];
  if (rawMessage && /Stack operation not supported for this transaction type/i.test(rawMessage)) {
    return "Loại điều chỉnh này hiện chưa hỗ trợ cho kiện sắt tiêu chuẩn.";
  }
  if (!rawMessage || technicalErrorPattern.test(rawMessage)) return fallback;
  return rawMessage;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    if (error.response?.data) {
      return resolveBusinessErrorMessage(error.response.data, fallback);
    }
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export const getApiErrorDetails = <TDetails>(error: unknown): TDetails | null => {
  if (!axios.isAxiosError<ErrorResponse<TDetails>>(error)) return null;
  return error.response?.data?.details ?? null;
};

export const getApiErrorCode = (error: unknown): string | null => {
  if (!axios.isAxiosError<ErrorResponse>(error)) return null;
  return error.response?.data?.code ?? null;
};

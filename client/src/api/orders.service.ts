import instance from "./api.service";
import type {
  ApproveOrderInput,
  CancelOrderInput,
  CreateOrderInput,
  IssueOrderInput,
  Order,
  OrderListParams,
  ReceiveOrderInput,
  RejectOrderInput,
  UpdateOrderInput,
} from "../types/orders";

interface ApiEnvelope<T> {
  data: T;
}

const get = <T>(response: ApiEnvelope<T>): T => response.data;

export const listOrders = async (params: OrderListParams = {}): Promise<Order[]> =>
  get(await instance.get<ApiEnvelope<Order[]>, ApiEnvelope<Order[]>>("orders", { params }));

export const getOrder = async (id: string): Promise<Order> =>
  get(await instance.get<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}`));

export const createOrder = async (input: CreateOrderInput): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>("orders", input));

export const updateOrder = async (id: string, input: UpdateOrderInput): Promise<Order> =>
  get(await instance.patch<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}`, input));

export const submitOrder = async (id: string): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/submit`));

export const approveOrder = async (id: string, input: ApproveOrderInput): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/approve`, input));

export const rejectOrder = async (id: string, input: RejectOrderInput): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/reject`, input));

export const issueOrder = async (id: string, input: IssueOrderInput): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/issue`, input));

export const receiveOrder = async (
  id: string,
  input: ReceiveOrderInput = {},
): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/receive`, input));

export const completeOrder = async (id: string): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/complete`));

export const cancelOrder = async (id: string, input: CancelOrderInput = {}): Promise<Order> =>
  get(await instance.post<ApiEnvelope<Order>, ApiEnvelope<Order>>(`orders/${id}/cancel`, input));

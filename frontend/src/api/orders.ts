import { request } from './client';
import type { ApiResponse, Order, OrderCreate, OrderQueryParams, RejectOrderPayload } from '../types/order';

function orderQuery(params?: OrderQueryParams) {
  const query = new URLSearchParams();

  if (params?.status) query.set('status', params.status);

  const value = query.toString();
  return value ? `?${value}` : '';
}

export async function createOrder(payload: OrderCreate) {
  const response = await request<ApiResponse<Order>>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
}

export async function getMyOrders() {
  const response = await request<ApiResponse<Order[]>>('/orders/my');
  return response.data;
}

export async function getAllOrders(params?: OrderQueryParams) {
  const response = await request<ApiResponse<Order[]>>(`/orders${orderQuery(params)}`);
  return response.data;
}

export async function getOrderById(id: number) {
  const response = await request<ApiResponse<Order>>(`/orders/${id}`);
  return response.data;
}

export async function approveOrder(id: number) {
  const response = await request<ApiResponse<Order>>(`/orders/${id}/approve`, {
    method: 'PATCH',
  });
  return response;
}

export async function rejectOrder(id: number, admin_response: RejectOrderPayload['admin_response']) {
  const response = await request<ApiResponse<Order>>(`/orders/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ admin_response }),
  });
  return response;
}

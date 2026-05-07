export type OrderStatus = 'pending' | 'approved' | 'rejected';

export type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
};

export type Order = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  status: OrderStatus;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderCreate = {
  items: {
    product_id: number;
    product_name: string;
    product_sku: string;
    quantity: number;
  }[];
};

export type RejectOrderPayload = {
  admin_response: string;
};

export type OrderQueryParams = {
  status?: OrderStatus;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

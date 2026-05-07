export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  description: string | null;
  price: string;
  quantity: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductCreate = {
  name: string;
  sku: string;
  category: string;
  description?: string;
  price: number;
  quantity: number;
};

export type ProductUpdate = {
  name?: string;
  category?: string;
  description?: string;
  price?: number;
};

export type StockUpdate = {
  quantity: number;
};

export type ProductQueryParams = {
  search?: string;
  category?: string;
  low_stock_only?: boolean;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

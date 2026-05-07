import { request } from './client';
import type { ApiResponse, Product, ProductCreate, ProductQueryParams, ProductUpdate } from '../types/product';

function productQuery(params?: ProductQueryParams) {
  const query = new URLSearchParams();

  if (params?.search) query.set('search', params.search);
  if (params?.category) query.set('category', params.category);
  if (params?.low_stock_only) query.set('low_stock_only', 'true');

  const value = query.toString();
  return value ? `?${value}` : '';
}

export async function getProducts(params?: ProductQueryParams) {
  const response = await request<ApiResponse<Product[]>>(`/products${productQuery(params)}`);
  return response.data;
}

export async function getProductById(id: number) {
  const response = await request<ApiResponse<Product>>(`/products/${id}`);
  return response.data;
}

export async function createProduct(payload: ProductCreate) {
  const response = await request<ApiResponse<Product>>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
}

export async function updateProduct(id: number, payload: ProductUpdate) {
  const response = await request<ApiResponse<Product>>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response;
}

export async function updateProductStock(id: number, quantity: number) {
  const response = await request<ApiResponse<Product>>(`/products/${id}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
  return response;
}

export async function deleteProduct(id: number) {
  return request<ApiResponse<null>>(`/products/${id}`, {
    method: 'DELETE',
  });
}

import { request, type ApiResponse } from './client';
import type { Notification } from '../types/notification';

export function getNotifications(params: { limit?: number; unread_only?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.unread_only !== undefined) search.set('unread_only', String(params.unread_only));
  const query = search.toString();
  return request<ApiResponse<Notification[]>>(`/audit/notifications${query ? `?${query}` : ''}`).then((response) => response.data);
}

export function getUnreadNotificationCount() {
  return request<ApiResponse<{ count: number }>>('/audit/notifications/unread-count').then((response) => response.data.count);
}

export function markNotificationRead(id: number) {
  return request<ApiResponse<Notification>>(`/audit/notifications/${id}/read`, {
    method: 'PATCH',
  }).then((response) => response.data);
}

export function markAllNotificationsRead() {
  return request<ApiResponse<{ updated_count: number }>>('/audit/notifications/read-all', {
    method: 'PATCH',
  }).then((response) => response.data);
}

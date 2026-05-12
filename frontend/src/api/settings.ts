import { request, type ApiResponse } from './client';

export type NotificationSettings = {
  telegram_admin_notifications_enabled: boolean;
  telegram_env_configured: boolean;
  telegram_global_enabled: boolean;
  telegram_target: string;
  telegram_token_visible: boolean;
  telegram_chat_id_visible: boolean;
};

export function getNotificationSettings() {
  return request<ApiResponse<NotificationSettings>>('/audit/settings/notifications');
}

export function updateTelegramNotificationSetting(enabled: boolean) {
  return request<ApiResponse<NotificationSettings>>('/audit/settings/notifications', {
    method: 'PATCH',
    body: JSON.stringify({ telegram_admin_notifications_enabled: enabled }),
  });
}

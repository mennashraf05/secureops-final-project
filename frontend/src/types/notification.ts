export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export type Notification = {
  id: number;
  user_id: number | null;
  role_target: 'admin' | 'user' | 'all' | null;
  title: string;
  message: string;
  category: string;
  severity: NotificationSeverity;
  source_service: string | null;
  source_action: string | null;
  source_id: number | null;
  is_read: boolean;
  created_at: string;
};

export type AuditLogStatus = 'success' | 'failure' | 'blocked' | 'info';

export type AuditLog = {
  id: number;
  user_id: number | null;
  action: string;
  service_name: string;
  ip_address: string | null;
  status: AuditLogStatus;
  details: string | null;
  created_at: string;
};

export type AuditLogQueryParams = {
  service_name?: string;
  action?: string;
  status?: AuditLogStatus;
  user_id?: number;
  limit?: number;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

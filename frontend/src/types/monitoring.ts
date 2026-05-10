export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type MonitoringSummary = {
  total_users: number;
  total_products: number;
  total_orders: number;
  pending_orders: number;
  approved_orders: number;
  rejected_orders: number;
  total_report_jobs: number;
  completed_report_jobs: number;
  failed_report_jobs: number;
  total_audit_logs: number;
  failed_logins: number;
  unauthorized_attempts: number;
  admin_denied_attempts: number;
  worker_completed_jobs: number;
  risk_score: number;
  risk_level: RiskLevel;
};

export type RiskFactor = {
  label: string;
  count: number;
  impact: number;
};

export type SecurityAlert = {
  id: number;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_service: string;
  action: string;
  user_id: number | null;
  ip_address: string | null;
  created_at: string;
  details: string | null;
};

export type RecentSecurityEvent = {
  id: number;
  action: string;
  service_name: string;
  user_id: number | null;
  ip_address: string | null;
  status: 'success' | 'failure' | 'blocked' | 'info';
  details: string | null;
  created_at: string;
};

export type SecurityOverview = {
  risk_score: number;
  risk_level: RiskLevel;
  failed_logins: number;
  unauthorized_attempts: number;
  admin_denied_attempts: number;
  risk_factors: RiskFactor[];
  alerts: SecurityAlert[];
  recent_security_events: RecentSecurityEvent[];
};

export type EventsOverTimePoint = {
  label: string;
  success: number;
  failure: number;
  blocked: number;
  info: number;
  total: number;
};

export type RiskTrendPoint = {
  label: string;
  risk_score: number;
};

export type BreakdownPoint = {
  label: string;
  value: number;
};

export type SecurityCharts = {
  events_over_time: EventsOverTimePoint[];
  risk_score_trend: RiskTrendPoint[];
  severity_breakdown: BreakdownPoint[];
  status_distribution: BreakdownPoint[];
};

export type UserRiskScore = {
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  failed_logins: number;
  unauthorized_attempts: number;
  admin_denied_attempts: number;
  ownership_denied_attempts: number;
  total_security_events: number;
  last_event_at: string | null;
};

export type UserRiskDetails = {
  summary: UserRiskScore;
  recent_audit_logs: Array<{
    id: number;
    user_id: number | null;
    action: string;
    service_name: string;
    ip_address: string | null;
    status: 'success' | 'failure' | 'blocked' | 'info';
    details: string | null;
    created_at: string;
  }>;
  top_risk_actions: Array<{
    action: string;
    count: number;
  }>;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ReportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ReportJobType = 'inventory_report' | 'low_stock_report';

export type ReportJob = {
  id: number;
  type: ReportJobType;
  status: ReportJobStatus;
  requested_by: number | string | null;
  result_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ReportJobQueryParams = {
  status?: ReportJobStatus;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

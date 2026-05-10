import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../../api/audit';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { AuditLog, AuditLogStatus } from '../../types/audit';

type ServiceFilter = 'all' | 'auth-service' | 'inventory-service' | 'order-service' | 'report-service' | 'worker-service' | 'audit-service';
type StatusFilter = 'all' | AuditLogStatus;

const serviceOptions: ServiceFilter[] = ['all', 'auth-service', 'inventory-service', 'order-service', 'report-service', 'worker-service', 'audit-service'];
const statusOptions: StatusFilter[] = ['all', 'success', 'failure', 'blocked', 'info'];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusTone(status: AuditLogStatus) {
  if (status === 'success') return 'green' as const;
  if (status === 'failure' || status === 'blocked') return 'red' as const;
  return 'cyan' as const;
}

function userId(value: AuditLog['user_id']) {
  return value === null || value === undefined ? 'System' : `User #${value}`;
}

function detailsPreview(value: string | null) {
  if (!value) return 'No details';

  try {
    const parsed = JSON.parse(value);
    const pretty = JSON.stringify(parsed, null, 2);
    return <details className="max-w-md">
      <summary className="cursor-pointer text-sm font-semibold text-blue-700">View details</summary>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-200">{pretty}</pre>
    </details>;
  } catch {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
}

export default function AuditLogs() {
  const { logoutUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadLogs() {
    setIsLoading(true);
    setError('');
    try {
      const userIdFilter = Number(userFilter);
      setLogs(await getAuditLogs({
        service_name: serviceFilter === 'all' ? undefined : serviceFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        action: actionFilter.trim() || undefined,
        user_id: Number.isFinite(userIdFilter) && userFilter.trim() ? userIdFilter : undefined,
        limit,
      }));
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load audit logs.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [serviceFilter, statusFilter, actionFilter, userFilter, limit]);

  const counts = useMemo(() => ({
    total: logs.length,
    success: logs.filter((log) => log.status === 'success').length,
    failure: logs.filter((log) => log.status === 'failure').length,
    blocked: logs.filter((log) => log.status === 'blocked').length,
    info: logs.filter((log) => log.status === 'info').length,
  }), [logs]);

  const rows = useMemo(() => logs.map((log) => [
    `#${log.id}`,
    formatDate(log.created_at),
    log.service_name,
    log.action,
    userId(log.user_id),
    log.ip_address || (log.service_name === 'worker-service' ? 'Internal' : 'Not captured'),
    <Badge tone={statusTone(log.status)}>{log.status}</Badge>,
    detailsPreview(log.details),
  ]), [logs]);

  return <>
    <PageHeader title="Audit Logs" subtitle="Search, filter, and review critical system and security activity."/>

    <div className="mb-6 flex flex-wrap gap-3">
      <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value as ServiceFilter)}>
        {serviceOptions.map((service) => <option key={service} value={service}>{service === 'all' ? 'All services' : service}</option>)}
      </select>
      <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
        {statusOptions.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
      </select>
      <input className="min-w-[220px] flex-1 rounded-2xl bg-white px-4 py-3 shadow-card outline-none ring-1 ring-slate-200" placeholder="Exact action, e.g. auth.login.success" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}/>
      <input className="w-32 rounded-2xl bg-white px-4 py-3 shadow-card outline-none ring-1 ring-slate-200" placeholder="User ID" inputMode="numeric" value={userFilter} onChange={(event) => setUserFilter(event.target.value)}/>
      <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
        <option value={20}>20 logs</option>
        <option value={50}>50 logs</option>
        <option value={100}>100 logs</option>
      </select>
      <Button variant="ghost" onClick={() => void loadLogs()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
    </div>

    <section className="grid gap-5 md:grid-cols-5">
      <KpiCard label="Total Logs" value={String(counts.total)} trend="Loaded"/>
      <KpiCard label="Success" value={String(counts.success)} trend="Healthy" tone="green"/>
      <KpiCard label="Failure" value={String(counts.failure)} trend="Review" tone="orange"/>
      <KpiCard label="Blocked" value={String(counts.blocked)} trend="Denied" tone="red"/>
      <KpiCard label="Info" value={String(counts.info)} trend="System" tone="cyan"/>
    </section>

    <section className="mt-7">
      <SectionCard title="Audit Logs Table" subtitle="Centralized security and business events from backend services.">
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading audit logs...</p> : null}
        {!isLoading && !error && logs.length === 0 ? <p className="text-sm font-semibold text-slate-500">No audit logs match these filters.</p> : null}
        {!isLoading && logs.length > 0 ? <DataTable columns={['Log ID','Time','Service','Action','User ID','IP Address','Status','Details']} rows={rows}/> : null}
      </SectionCard>
    </section>
  </>;
}

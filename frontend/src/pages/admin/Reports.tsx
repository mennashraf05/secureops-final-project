import { useEffect, useMemo, useState } from 'react';
import { createInventoryReport, getReportJobs } from '../../api/reports';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { KpiCard } from '../../components/cards/KpiCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { ReportJob, ReportJobStatus } from '../../types/report';

type FilterValue = 'all' | ReportJobStatus;

function formatDate(value: string | null) {
  if (!value) return 'Not completed yet';
  return new Date(value).toLocaleString();
}

function statusTone(status: ReportJobStatus) {
  if (status === 'completed') return 'green' as const;
  if (status === 'failed') return 'red' as const;
  if (status === 'processing') return 'cyan' as const;
  return 'orange' as const;
}

function requestedBy(value: ReportJob['requested_by']) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return `User #${value}`;
}

export default function Reports() {
  const { logoutUser } = useAuth();
  const [allJobs, setAllJobs] = useState<ReportJob[]>([]);
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadJobs() {
    setIsLoading(true);
    setError('');
    try {
      const nextAllJobs = await getReportJobs();
      setAllJobs(nextAllJobs);
      setJobs(statusFilter === 'all' ? nextAllJobs : await getReportJobs({ status: statusFilter }));
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load report jobs.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, [statusFilter]);

  async function generateInventoryReport() {
    setMessage('');
    setError('');
    setIsCreating(true);
    try {
      await createInventoryReport();
      setMessage('Inventory report job created successfully.');
      await loadJobs();
      window.setTimeout(() => void loadJobs(), 3000);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not create inventory report job.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsCreating(false);
    }
  }

  const counts = useMemo(() => ({
    total: allJobs.length,
    pending: allJobs.filter((job) => job.status === 'pending').length,
    completed: allJobs.filter((job) => job.status === 'completed').length,
    failed: allJobs.filter((job) => job.status === 'failed').length,
  }), [allJobs]);

  const rows = useMemo(() => jobs.map((job) => [
    `#${job.id}`,
    job.type,
    <Badge tone={statusTone(job.status)}>{job.status}</Badge>,
    requestedBy(job.requested_by),
    formatDate(job.created_at),
    formatDate(job.completed_at),
    job.result_path || 'Not available yet',
    job.status === 'failed' ? job.error_message || 'No error details available.' : '',
  ]), [jobs]);

  return <>
    <PageHeader title="Reports & Background Jobs" subtitle="Generate reports asynchronously and monitor RabbitMQ worker processing."/>

    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <SectionCard title="Generate Inventory Report" subtitle="Submit RabbitMQ background job">
        <Button onClick={() => void generateInventoryReport()} disabled={isCreating}>{isCreating ? 'Generating...' : 'Generate Inventory Report'}</Button>
      </SectionCard>
      <SectionCard title="Generate Security Report" subtitle="Not implemented in Part 6.5"><Button disabled>Generate</Button></SectionCard>
      <SectionCard title="Generate Audit Report" subtitle="Not implemented in Part 6.5"><Button disabled>Generate</Button></SectionCard>
      <SectionCard title="Generate Low Stock Report" subtitle="Not implemented in Part 6.5"><Button disabled>Generate</Button></SectionCard>
    </section>

    <section className="mt-7 grid gap-5 md:grid-cols-4">
      <KpiCard label="Total Jobs" value={String(counts.total)} trend="Live"/>
      <KpiCard label="Pending" value={String(counts.pending)} trend="Queue" tone="orange"/>
      <KpiCard label="Completed" value={String(counts.completed)} trend="Worker" tone="green"/>
      <KpiCard label="Failed" value={String(counts.failed)} trend="Review" tone="red"/>
    </section>

    <section className="mt-7 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <SectionCard title="RabbitMQ Queue Monitor" subtitle="Queue health and worker processing">
        <div className="grid gap-3 text-sm">
          <p><b>Jobs Loaded:</b> {jobs.length}</p>
          <p><b>Pending Jobs:</b> {counts.pending}</p>
          <p><b>Completed Jobs:</b> {counts.completed}</p>
          <p><b>Failed Jobs:</b> {counts.failed}</p>
          <p><b>Queue Health:</b> Report Service connected</p>
        </div>
      </SectionCard>
      <SectionCard title="Jobs Table" subtitle="Recent asynchronous jobs">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="ghost" onClick={() => void loadJobs()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
        </div>

        {message && <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading report jobs...</p> : null}
        {!isLoading && !error && jobs.length === 0 ? <p className="text-sm font-semibold text-slate-500">No report jobs match this filter.</p> : null}
        {!isLoading && jobs.length > 0 ? <DataTable columns={['Job ID','Type','Status','Requested By','Created At','Completed At','Result Path','Error Message']} rows={rows}/> : null}
      </SectionCard>
    </section>
  </>;
}

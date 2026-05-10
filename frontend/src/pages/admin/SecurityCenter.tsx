import { useEffect, useState } from 'react';
import { dismissSecurityAlert, getSecurityCharts, getSecurityOverview, getUserRiskScores } from '../../api/monitoring';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { EventsBarChart, RiskLineChart, SeverityPie } from '../../components/charts/Charts';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { RiskLevel, SecurityCharts, SecurityOverview, UserRiskScore } from '../../types/monitoring';

function riskTone(level?: RiskLevel) {
 if (level === 'Critical' || level === 'High') return 'red' as const;
 if (level === 'Medium') return 'orange' as const;
 return 'green' as const;
}

export default function SecurityCenter() {
 const { logoutUser } = useAuth();
 const [overview, setOverview] = useState<SecurityOverview | null>(null);
 const [charts, setCharts] = useState<SecurityCharts | null>(null);
 const [userRiskScores, setUserRiskScores] = useState<UserRiskScore[]>([]);
 const [riskLimit, setRiskLimit] = useState(20);
 const [riskLevelFilter, setRiskLevelFilter] = useState<RiskLevel | 'all'>('all');
 const [isLoading, setIsLoading] = useState(true);
 const [dismissingAlertId, setDismissingAlertId] = useState<number | null>(null);
 const [error, setError] = useState('');
 const [message, setMessage] = useState('');

 async function loadOverview() {
  setIsLoading(true);
  setError('');
  try {
   const [nextOverview, nextCharts] = await Promise.all([
    getSecurityOverview(),
    getSecurityCharts(),
   ]);
   setOverview(nextOverview);
   setCharts(nextCharts);
   setUserRiskScores(await getUserRiskScores({ limit: riskLimit, risk_level: riskLevelFilter }));
  } catch (err) {
   const nextError = err instanceof Error ? err.message : 'Could not load security overview.';
   if (nextError === 'Invalid or expired token.') {
    await logoutUser();
   }
   setError(nextError);
  } finally {
   setIsLoading(false);
  }
 }

 async function handleDismissAlert(auditLogId: number) {
  if (!window.confirm('Dismiss this alert? The original audit log will remain available.')) return;

  setError('');
  setMessage('');
  setDismissingAlertId(auditLogId);
  try {
   await dismissSecurityAlert(auditLogId);
   setMessage('Security alert dismissed successfully.');
   await loadOverview();
  } catch (err) {
   const nextError = err instanceof Error ? err.message : 'Could not dismiss security alert.';
   if (nextError === 'Invalid or expired token.') {
    await logoutUser();
   }
   setError(nextError);
  } finally {
   setDismissingAlertId(null);
  }
 }

 useEffect(() => {
  void loadOverview();
 }, [riskLimit, riskLevelFilter]);

 const alerts = overview?.alerts ?? [];
 const recentEvents = overview?.recent_security_events ?? [];
 const userRiskRows = userRiskScores.map((score) => [
  score.user_name || (score.user_id === null ? 'System / Unknown' : `User #${score.user_id}`),
  score.user_email || 'No email',
  String(score.risk_score),
  <Badge tone={riskTone(score.risk_level)}>{score.risk_level}</Badge>,
  String(score.failed_logins),
  String(score.unauthorized_attempts),
  String(score.admin_denied_attempts),
  score.last_event_at ? new Date(score.last_event_at).toLocaleString() : 'No events',
 ]);

 return <><PageHeader title="Security Center" subtitle="Monitor suspicious behavior, risk scores, critical alerts, and attack patterns."/>
 <section className="mb-7 rounded-[2rem] border border-red-200 bg-gradient-to-r from-red-950 to-slate-950 p-6 text-white shadow-[0_0_50px_rgba(220,38,38,.25)]"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-bold uppercase tracking-widest text-red-200">SOC Overview</p><h2 className="mt-2 text-2xl font-extrabold">Risk score {overview?.risk_score ?? 0} - {overview?.risk_level ?? 'Low'} <Badge tone={riskTone(overview?.risk_level)} className="ml-2">{overview?.risk_level ?? 'Low'}</Badge></h2></div><Button variant="danger" onClick={() => void loadOverview()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button></div></section>
 {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
 {message && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
 {isLoading ? <p className="mb-5 text-sm font-semibold text-slate-500">Loading security overview...</p> : null}
 <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6"><KpiCard label="Failed Logins" value={String(overview?.failed_logins ?? 0)} trend="Live" tone="orange"/><KpiCard label="Unauthorized Access" value={String(overview?.unauthorized_attempts ?? 0)} trend="Blocked" tone="red"/><KpiCard label="Admin Denied" value={String(overview?.admin_denied_attempts ?? 0)} trend="RBAC" tone="red"/><KpiCard label="Risk Score" value={String(overview?.risk_score ?? 0)} trend={overview?.risk_level ?? 'Low'} tone={riskTone(overview?.risk_level)}/><KpiCard label="Alerts" value={String(alerts.length)} trend="Derived" tone="violet"/><KpiCard label="Risk Factors" value={String(overview?.risk_factors.length ?? 0)} trend="Weighted" tone="cyan"/></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-3"><SectionCard title="Security Events Over Time"><EventsBarChart data={charts?.events_over_time}/></SectionCard><SectionCard title="Risk Score Trend"><RiskLineChart data={charts?.risk_score_trend}/></SectionCard><SectionCard title="Severity Breakdown"><SeverityPie data={charts?.severity_breakdown}/></SectionCard></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-2"><SectionCard title="Risk Factors" subtitle="Weighted drivers of the current score">{overview?.risk_factors.length ? <DataTable columns={['Reason','Count','Impact']} rows={overview.risk_factors.map(f=>[f.label,String(f.count),String(f.impact)])}/> : <p className="text-sm font-semibold text-slate-500">No active risk factors.</p>}</SectionCard><SectionCard title="Security Alerts" subtitle="Derived from audit events">{alerts.length ? <DataTable columns={['Alert','User / IP','Severity','Time','Action','Review']} rows={alerts.map(a=>[a.title,a.ip_address || `User #${a.user_id ?? 'System'}`,a.severity,new Date(a.created_at).toLocaleString(),a.action,<Button variant="ghost" onClick={() => void handleDismissAlert(a.audit_log_id)} disabled={dismissingAlertId === a.audit_log_id}>{dismissingAlertId === a.audit_log_id ? 'Dismissing...' : 'Dismiss'}</Button>])}/> : <p className="text-sm font-semibold text-slate-500">No active security alerts.</p>}</SectionCard></section>
 <section className="mt-7"><SectionCard title="Per-User Risk Scores" subtitle="Users and system actors sorted by audit-log-derived risk"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={riskLevelFilter} onChange={(event) => setRiskLevelFilter(event.target.value as RiskLevel | 'all')}><option value="all">All risk levels</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select><select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={riskLimit} onChange={(event) => setRiskLimit(Number(event.target.value))}><option value={10}>10 users</option><option value={20}>20 users</option><option value={50}>50 users</option></select></div>{isLoading ? <p className="text-sm font-semibold text-slate-500">Loading user risk scores...</p> : null}{!isLoading && userRiskRows.length ? <DataTable columns={['User','Email','Risk Score','Risk Level','Failed Logins','Unauthorized Attempts','Admin Denied','Last Event']} rows={userRiskRows}/> : null}{!isLoading && !userRiskRows.length ? <p className="text-sm font-semibold text-slate-500">No user risk events found.</p> : null}</SectionCard></section>
 <section className="mt-7"><SectionCard title="Recent Security Events" subtitle="Blocked and failed activity from audit logs">{recentEvents.length ? <DataTable columns={['Service','Action','User / IP','Status','Time']} rows={recentEvents.map(e=>[e.service_name,e.action,e.ip_address || `User #${e.user_id ?? 'System'}`,e.status,new Date(e.created_at).toLocaleString()])}/> : <p className="text-sm font-semibold text-slate-500">No recent security events.</p>}</SectionCard></section>
 </>;
}

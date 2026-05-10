import { useEffect, useState } from 'react';
import { Boxes, FileCheck, ShieldAlert, Zap } from 'lucide-react';
import { getMonitoringSummary, getSecurityOverview } from '../../api/monitoring';
import { useAuth } from '../../auth/AuthContext';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { EventsBarChart, RiskLineChart } from '../../components/charts/Charts';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/layout/Page';
import type { MonitoringSummary, SecurityOverview } from '../../types/monitoring';

function riskTone(level?: MonitoringSummary['risk_level']) {
  if (level === 'Critical' || level === 'High') return 'red' as const;
  if (level === 'Medium') return 'orange' as const;
  return 'green' as const;
}

export default function AdminDashboard() {
  const { logoutUser } = useAuth();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [security, setSecurity] = useState<SecurityOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    setError('');
    try {
      const [nextSummary, nextSecurity] = await Promise.all([
        getMonitoringSummary(),
        getSecurityOverview(),
      ]);
      setSummary(nextSummary);
      setSecurity(nextSecurity);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load monitoring data.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const metrics = [
    { label: 'Total Users', value: String(summary?.total_users ?? 0), trend: 'Auth', tone: 'blue' as const },
    { label: 'Total Products', value: String(summary?.total_products ?? 0), trend: 'Inventory', tone: 'green' as const },
    { label: 'Total Orders', value: String(summary?.total_orders ?? 0), trend: `${summary?.pending_orders ?? 0} pending`, tone: 'cyan' as const },
    { label: 'Completed Report Jobs', value: String(summary?.completed_report_jobs ?? 0), trend: `${summary?.failed_report_jobs ?? 0} failed`, tone: 'violet' as const },
    { label: 'Failed Logins', value: String(summary?.failed_logins ?? 0), trend: 'Security', tone: 'orange' as const },
    { label: 'Risk Score', value: String(summary?.risk_score ?? 0), trend: summary?.risk_level ?? 'Low', tone: riskTone(summary?.risk_level) },
  ];

  const alertRows = (security?.alerts ?? []).slice(0, 4).map((alert) => [
    alert.title,
    alert.ip_address || `User #${alert.user_id ?? 'System'}`,
    alert.severity,
    alert.action,
  ]);

  return <>
    <PageHeader title="Operations & Security Command Center" subtitle="Monitor inventory operations, distributed services, background jobs, and security events."/>
    <section className="mb-7 overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy via-ink to-blue-900 p-7 text-white shadow-glow grid-bg"><div className="flex flex-col justify-between gap-8 lg:flex-row"><div><p className="text-sm font-bold uppercase tracking-widest text-cyan-300">{summary ? `${summary.risk_level} Risk` : 'Monitoring Data'}</p><h2 className="mt-3 text-3xl font-extrabold">Welcome Admin - distributed inventory is protected.</h2><p className="mt-2 max-w-2xl text-cyan-100/75">Risk scoring, audit activity, RabbitMQ jobs, and inventory signals are available from this command center.</p></div><div className="flex flex-wrap gap-3 self-start"><Button onClick={() => void loadDashboard()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button><Button variant="dark" disabled>Generate Report</Button></div></div></section>
    {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {isLoading ? <p className="mb-5 text-sm font-semibold text-slate-500">Loading monitoring data...</p> : null}
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{metrics.map(m => <KpiCard key={m.label} {...m}/>)}</section>
    <section className="mt-7 grid gap-6 xl:grid-cols-2"><SectionCard title="Risk Score Trend" subtitle="Weekly risk score movement"><RiskLineChart/></SectionCard><SectionCard title="Security Events Overview" subtitle="Blocked and reviewed events"><EventsBarChart/></SectionCard></section>
    <section className="mt-7 grid gap-6 xl:grid-cols-3"><SectionCard title="Recent Security Alerts" subtitle="Live suspicious activity">{alertRows.length ? <DataTable columns={['Event','User / IP','Severity','Status']} rows={alertRows}/> : <p className="text-sm font-semibold text-slate-500">No active security alerts.</p>}</SectionCard><SectionCard title="Order Status" subtitle="Operational order flow"><DataTable columns={['Status','Count','Signal']} rows={[['Pending', String(summary?.pending_orders ?? 0), 'Review'], ['Approved', String(summary?.approved_orders ?? 0), 'Healthy'], ['Rejected', String(summary?.rejected_orders ?? 0), 'Closed']]}/></SectionCard><SectionCard title="Quick Actions" subtitle="Common admin operations"><div className="grid gap-3"><Button><Boxes className="mr-2 inline" size={17}/>Add Product</Button><Button variant="ghost"><FileCheck className="mr-2 inline" size={17}/>Verify File Integrity</Button><Button variant="ghost"><ShieldAlert className="mr-2 inline" size={17}/>Open Security Center</Button><Button variant="ghost" disabled><Zap className="mr-2 inline" size={17}/>Run Attack Simulation</Button></div></SectionCard></section>
    <section className="mt-7"><SectionCard title="System Health" subtitle="Nginx, Auth, Inventory, Orders, Files, PostgreSQL, RabbitMQ, Worker Service"><div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">{['Nginx Gateway','Auth Service','Inventory Service','Order Service','File Service','Report Service','PostgreSQL','RabbitMQ','Worker Service'].map((s,i)=><div key={s} className="rounded-2xl bg-slate-50 p-4"><span className={`mr-2 inline-block h-2.5 w-2.5 animate-pulseSoft rounded-full ${i===7?'bg-amber-400':'bg-emerald-500'}`}/><p className="font-bold text-slate-800">{s}</p><p className="mt-1 text-xs text-slate-500">Live monitoring</p></div>)}</div></SectionCard></section>
  </>;
}

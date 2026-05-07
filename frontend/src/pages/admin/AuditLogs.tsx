import { auditLogs } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
export default function AuditLogs() {
 return <><PageHeader title="Audit Logs" subtitle="Search, filter, and review critical system and security activity."/>
 <div className="mb-6 flex flex-wrap gap-3"><input className="min-w-[280px] flex-1 rounded-2xl bg-white px-4 py-3 shadow-card outline-none ring-1 ring-slate-200" placeholder="Search action, user, IP..."/><Button variant="ghost">Action Filter</Button><Button variant="ghost">Severity Filter</Button><Button>Export</Button></div>
 <section className="grid gap-5 md:grid-cols-5"><KpiCard label="Total Logs" value="8,924" trend="30 days"/><KpiCard label="Failed Actions" value="48" trend="Review" tone="orange"/><KpiCard label="Critical Events" value="9" trend="Critical" tone="red"/><KpiCard label="Admin Actions" value="314" trend="Tracked" tone="cyan"/><KpiCard label="File Events" value="128" trend="Verified" tone="green"/></section>
 <section className="mt-7"><SectionCard title="Audit Logs Table" subtitle="Critical rows are highlighted and can open a log detail modal."><DataTable columns={['Timestamp','User ID','Action','IP Address','Status','Severity','Details']} rows={auditLogs.map(l=>[l.timestamp,l.user,l.action,l.ip,l.status,l.severity,l.details])}/></SectionCard></section>
 </>;
}

import { securityEvents } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { EventsBarChart, RiskLineChart, SeverityPie } from '../../components/charts/Charts';
import { Button } from '../../components/ui/Button';
export default function SecurityCenter() {
 return <><PageHeader title="Security Center" subtitle="Monitor suspicious behavior, risk scores, critical alerts, and attack patterns."/>
 <section className="mb-7 rounded-[2rem] border border-red-200 bg-gradient-to-r from-red-950 to-slate-950 p-6 text-white shadow-[0_0_50px_rgba(220,38,38,.25)]"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-bold uppercase tracking-widest text-red-200">Critical SOC Banner</p><h2 className="mt-2 text-2xl font-extrabold">3 critical events require immediate review</h2></div><Button variant="danger">Investigate Now</Button></div></section>
 <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6"><KpiCard label="Failed Logins" value="27" trend="Live" tone="orange"/><KpiCard label="Unauthorized Access" value="12" trend="High" tone="red"/><KpiCard label="Malicious Uploads" value="4" trend="Blocked" tone="red"/><KpiCard label="Rate Limit Violations" value="19" trend="Medium" tone="orange"/><KpiCard label="Invalid Token Events" value="9" trend="JWT" tone="red"/><KpiCard label="High Risk Users" value="7" trend="Review" tone="violet"/></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-3"><SectionCard title="Security Events Over Time"><EventsBarChart/></SectionCard><SectionCard title="Risk Score Distribution"><RiskLineChart/></SectionCard><SectionCard title="Severity Breakdown"><SeverityPie/></SectionCard></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-2"><SectionCard title="Risk Score Table" subtitle="User/IP risk and top reasons"><DataTable columns={['User / IP','Risk Score','Risk Level','Last Activity','Top Reason','Actions']} rows={[['192.168.1.44','96','Critical','2 min ago','Invalid JWT','Investigate'],['10.10.0.24','84','High','18 min ago','Rate limit','Block IP'],['worker-service','79','High','22 min ago','Missing API key','Export']]}/></SectionCard><SectionCard title="Security Events Table" subtitle="Critical alerts and actions"><DataTable columns={['Event Type','User / IP','Severity','Time','Status','Action']} rows={securityEvents.map(e=>[e.event,e.user,e.severity,e.time,e.status,'Investigate'])}/></SectionCard></section>
 </>;
}

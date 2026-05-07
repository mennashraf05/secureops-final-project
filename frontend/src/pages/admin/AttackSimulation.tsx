import { simulations } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { KpiCard } from '../../components/cards/KpiCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
export default function AttackSimulation() {
 return <><PageHeader title="Attack Simulation Lab" subtitle="Run controlled attack scenarios to validate authentication, authorization, file security, rate limiting, and internal service protection."/>
 <SectionCard title="Controlled Security Validation" subtitle="Each simulation verifies that the attack is blocked, logged, assigned a risk score, and converted into a security alert." dark><div className="flex flex-wrap gap-3"><Button>Run All Simulations</Button><Button variant="dark">Clear Results</Button><Button variant="danger">Export Simulation Report</Button></div></SectionCard>
 <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{simulations.map(([name,code,severity])=><SectionCard key={name} title={name} subtitle={`Expected status code: ${code}`}><Badge tone={severity==='Critical'?'red':severity==='High'?'orange':'cyan'}>{severity}</Badge><p className="mt-3 text-sm text-slate-500">Expected to be blocked, logged, scored, and converted to an alert.</p><Button className="mt-4">Run</Button></SectionCard>)}</section>
 <section className="mt-7 grid gap-5 md:grid-cols-5"><KpiCard label="Total Simulations Run" value="11" trend="All"/><KpiCard label="Passed" value="11" trend="100%" tone="green"/><KpiCard label="Failed" value="0" trend="Clean" tone="green"/><KpiCard label="Alerts Triggered" value="11" trend="SOC" tone="red"/><KpiCard label="Risk Score Increased" value="+42" trend="Expected" tone="orange"/></section>
 <section className="mt-7"><SectionCard title="Simulation Results Table" subtitle="Live result rows animate into this table after a run."><DataTable columns={['Attack Type','Expected Response','Status Code','Audit Logged?','Risk Score Impact','Alert Created?','Severity','Timestamp']} rows={simulations.slice(0,6).map(([n,c,s])=>[n,'Blocked',c,'Yes',s==='Critical'?'+15':'+8','Yes',s,'Now'])}/></SectionCard></section>
 </>;
}

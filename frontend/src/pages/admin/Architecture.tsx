import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Badge } from '../../components/ui/Badge';
const nodes = ['Client / Browser','Nginx API Gateway','Auth Service','Inventory Service','Order Service','File Service','Report Service','Worker Service','PostgreSQL','RabbitMQ','Audit Logs','Security Center'];
export default function Architecture() {
 return <><PageHeader title="Distributed System Architecture" subtitle="A visually impressive architecture diagram for project presentation."/>
 <section className="rounded-[2rem] bg-gradient-to-br from-navy to-slate-950 p-6 text-white shadow-glow grid-bg"><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">{nodes.map((n,i)=><div key={n} className="relative rounded-3xl border border-cyan-300/35 bg-slate-950/70 p-5 backdrop-blur-xl shadow-glow"><div className="absolute -right-2 top-1/2 hidden h-0.5 w-6 bg-cyan-300 md:block"/><p className="font-bold text-white">{n}</p><p className="mt-2 text-xs text-cyan-200">{i<2?'HTTPS / JWT':i===9?'Message Queue':i>9?'Audit Events':'RBAC / Internal API Key'}</p></div>)}</div><div className="mt-8 flex flex-wrap gap-3">{['HTTPS','JWT','RBAC','Internal API Key','Message Queue','Background Jobs','Audit Events','Secure File Encryption'].map(x=><Badge key={x} tone="cyan">{x}</Badge>)}</div></section>
 <section className="mt-7 grid gap-5 lg:grid-cols-3"><SectionCard title="Gateway Layer" subtitle="Nginx routes, rate limits, and protects public API access."/><SectionCard title="Service Layer" subtitle="Auth, inventory, order, file, report, and worker services are separated."/><SectionCard title="Security Controls" subtitle="JWT validation, RBAC, internal API keys, audit events, encryption, SHA-256 integrity."/></section>
 </>;
}

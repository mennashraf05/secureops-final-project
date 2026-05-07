import { jobs } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { KpiCard } from '../../components/cards/KpiCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
export default function Reports() {
  return <><PageHeader title="Reports & Background Jobs" subtitle="Generate reports asynchronously and monitor RabbitMQ worker processing."/>
  <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{['Generate Inventory Report','Generate Security Report','Generate Audit Report','Generate Low Stock Report'].map(x=><SectionCard key={x} title={x} subtitle="Submit RabbitMQ background job"><Button>Generate</Button></SectionCard>)}</section>
  <section className="mt-7 grid gap-5 md:grid-cols-4"><KpiCard label="Pending Jobs" value="8" trend="Queue" tone="orange"/><KpiCard label="Processing Jobs" value="3" trend="Live" tone="cyan"/><KpiCard label="Completed Jobs" value="154" trend="+18.6%" tone="green"/><KpiCard label="Failed Jobs" value="2" trend="Retry" tone="red"/></section>
  <section className="mt-7 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><SectionCard title="RabbitMQ Queue Monitor" subtitle="Queue health and worker processing"><div className="grid gap-3 text-sm"><p><b>Messages Ready:</b> 14</p><p><b>Messages Processing:</b> 3</p><p><b>Consumers Online:</b> 2</p><p><b>Last Processed Job:</b> Security Report</p><p><b>Queue Health:</b> Healthy</p></div></SectionCard><SectionCard title="Jobs Table" subtitle="Recent asynchronous jobs"><DataTable columns={['Job ID','Type','Requested By','Status','Created At','Completed At','Result','Actions']} rows={jobs.map(j=>[j.id,j.type,j.requestedBy,j.status,j.created,j.completed,j.result,'View • Download • Retry'])}/></SectionCard></section>
  </>;
}

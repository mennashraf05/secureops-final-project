import { orders } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
export default function Orders() {
  return <><PageHeader title="Order Management" subtitle="Track stock requests, approvals, rejections, and fulfillment status."/>
  <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5"><KpiCard label="Total Orders" value="198" trend="+8.7%"/><KpiCard label="Pending Orders" value="24" trend="Review" tone="orange"/><KpiCard label="Approved Orders" value="82" trend="Healthy" tone="green"/><KpiCard label="Rejected Orders" value="9" trend="-1.2%" tone="red"/><KpiCard label="Completed Orders" value="83" trend="+10" tone="cyan"/></section>
  <section className="mt-7"><SectionCard title="Orders Table" subtitle="Includes search, status filter, priority filter, date range, and side drawer preview."><DataTable columns={['Order ID','User','Product','Quantity','Status','Priority','Date','Actions']} rows={orders.map(o=>[o.id,o.user,o.product,o.quantity,o.status,o.priority,o.date,'View • Approve • Reject'])}/></SectionCard></section>
  <section className="mt-7 grid gap-5 lg:grid-cols-3"><SectionCard title="Order Details Drawer" subtitle="Timeline, requester info, product availability"/><SectionCard title="Approval Modal" subtitle="Admin confirmation with success toast"><Button>Approve Selected Order</Button></SectionCard><SectionCard title="Rejection Modal" subtitle="Reason field saved to audit logs"><Button variant="danger">Reject With Reason</Button></SectionCard></section>
  </>;
}

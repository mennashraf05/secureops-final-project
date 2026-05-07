import { orders } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
export default function MyOrders() {
 return <><PageHeader title="My Orders" subtitle="Track your submitted inventory requests and approval status."/>
 <SectionCard title="My Orders Only" subtitle="Normal users can only see their own requests."><DataTable columns={['Order ID','Product','Quantity','Status','Date','Admin Response','Actions']} rows={orders.map(o=>[o.id,o.product,o.quantity,o.status,o.date,o.response,'View Details'])}/></SectionCard>
 <section className="mt-7 grid gap-5 md:grid-cols-2"><SectionCard title="Order Details Modal" subtitle="Includes status timeline and admin response."/><SectionCard title="Empty State" subtitle="Shown when the user has not submitted any requests."/></section>
 </>;
}

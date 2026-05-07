import { products, orders, files } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
export default function UserDashboard() {
 return <><PageHeader title="My Inventory Portal" subtitle="View available products, submit stock requests, and track your order status."/>
 <section className="mb-7 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-card"><p className="text-sm font-bold uppercase tracking-widest text-blue-600">Account role: User</p><h2 className="mt-2 text-3xl font-extrabold">Welcome to your secure inventory workspace.</h2><p className="mt-2 text-slate-500">Your access is limited by role-based permissions. Admin security tools are hidden.</p><Button className="mt-5">Request Product</Button></section>
 <section className="grid gap-5 md:grid-cols-5"><KpiCard label="My Pending Requests" value="3" trend="Waiting" tone="orange"/><KpiCard label="My Approved Orders" value="12" trend="Active" tone="green"/><KpiCard label="My Rejected Orders" value="1" trend="Review" tone="red"/><KpiCard label="Available Products" value="286" trend="Browse"/><KpiCard label="Shared Files" value="8" trend="Secure" tone="cyan"/></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-3"><SectionCard title="Recent Products"><DataTable columns={['Product','SKU','Available','Status']} rows={products.slice(0,3).map(p=>[p.name,p.sku,p.quantity,p.status])}/></SectionCard><SectionCard title="My Recent Orders"><DataTable columns={['Order ID','Product','Status','Response']} rows={orders.slice(0,3).map(o=>[o.id,o.product,o.status,o.response])}/></SectionCard><SectionCard title="Shared Files"><DataTable columns={['File','Type','Integrity','Action']} rows={files.slice(0,2).map(f=>[f.name,f.type,f.integrity,'Download'])}/></SectionCard></section>
 </>;
}

import { products } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
export default function UserProducts() {
 return <><PageHeader title="Available Products" subtitle="Browse available inventory and submit product requests."/>
 <div className="mb-6 flex flex-wrap gap-3"><input className="min-w-[280px] flex-1 rounded-2xl bg-white px-4 py-3 shadow-card outline-none ring-1 ring-slate-200" placeholder="Search products..."/><Button variant="ghost">Category</Button><Button variant="ghost">Availability</Button></div>
 <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{products.map(p=><SectionCard key={p.sku} title={p.name} subtitle={`${p.sku} • ${p.category}`}><div className="flex items-end justify-between"><div><p className="text-3xl font-extrabold">{p.quantity}</p><p className="text-sm text-slate-500">Available quantity</p></div><Badge tone={p.status==='In Stock'?'green':p.status==='Low Stock'?'orange':'red'}>{p.status}</Badge></div><Button className="mt-5" disabled={p.quantity===0}>Request Product</Button></SectionCard>)}</section>
 <section className="mt-7"><SectionCard title="Request Product Modal" subtitle="Quantity input, request reason, submit button, success toast: Request submitted successfully."/></section>
 </>;
}

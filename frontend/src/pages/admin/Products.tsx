import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { products } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
export default function Products() {
  return <><PageHeader title="Inventory Management" subtitle="Control stock, pricing, product lifecycle, and inventory availability."/>
  <div className="mb-6 flex flex-wrap items-center gap-3"><div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200"><Search size={18}/><input placeholder="Search product, SKU, category..." className="w-full outline-none"/></div><Button variant="ghost"><SlidersHorizontal size={17} className="mr-2 inline"/> Filters</Button><Button><Plus size={17} className="mr-2 inline"/> Add Product</Button></div>
  <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5"><KpiCard label="Total Products" value="342" trend="+5.2%"/><KpiCard label="Low Stock Items" value="18" trend="Needs review" tone="orange"/><KpiCard label="Out of Stock" value="6" trend="Critical" tone="red"/><KpiCard label="Inventory Value" value="$128K" trend="+9.4%" tone="green"/><KpiCard label="Recently Updated" value="42" trend="Today" tone="cyan"/></section>
  <section className="mt-7"><SectionCard title="Product Table" subtitle="Low stock rows are visually highlighted with progress-ready quantities."><DataTable columns={['Product','SKU','Category','Quantity','Price','Status','Last Updated','Actions']} rows={products.map(p=>[p.name,p.sku,p.category,p.quantity,p.price,p.status,p.updated,'View • Edit • Delete'])}/></SectionCard></section>
  <section className="mt-7 grid gap-5 md:grid-cols-3"><SectionCard title="Add Product Modal" subtitle="Clean form with validation and success toast"/><SectionCard title="Update Stock Modal" subtitle="Quantity update with audit trail preview"/><SectionCard title="Delete Confirmation" subtitle="Critical action confirmation and error state"/></section>
  </>;
}

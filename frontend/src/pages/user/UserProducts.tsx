import { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../../api/products';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { Product } from '../../types/product';

function stockStatus(quantity: number) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= 5) return 'Low Stock';
  return 'In Stock';
}

export default function UserProducts() {
  const { logoutUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadProducts() {
    setIsLoading(true);
    setError('');
    try {
      const data = await getProducts({ search, category: category || undefined });
      setProducts(data);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load products.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProducts();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, category]);

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category))).sort(), [products]);
  const visibleProducts = useMemo(() => {
    if (!availability) return products;
    return products.filter((product) => stockStatus(product.quantity) === availability);
  }, [availability, products]);

  function showRequestPlaceholder() {
    setMessage('Product request feature will be available after Order Service integration.');
  }

  return <>
    <PageHeader title="Available Products" subtitle="Browse available inventory and submit product requests."/>
    <div className="mb-6 flex flex-wrap gap-3">
      <input className="min-w-[280px] flex-1 rounded-2xl bg-white px-4 py-3 shadow-card outline-none ring-1 ring-slate-200" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} />
      <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Category</option>
        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={availability} onChange={(event) => setAvailability(event.target.value)}>
        <option value="">Availability</option>
        <option value="In Stock">In Stock</option>
        <option value="Low Stock">Low Stock</option>
        <option value="Out of Stock">Out of Stock</option>
      </select>
    </div>

    {message && <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">{message}</div>}
    {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    {isLoading ? <SectionCard title="Available Products" subtitle="Loading live inventory data..."/> : <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {visibleProducts.map((product) => {
        const status = stockStatus(product.quantity);
        return <SectionCard key={product.sku} title={product.name} subtitle={`${product.sku} - ${product.category}`}>
          <p className="mb-5 line-clamp-2 text-sm text-slate-500">{product.description || 'No product description available.'}</p>
          <div className="flex items-end justify-between">
            <div><p className="text-3xl font-extrabold">{product.quantity}</p><p className="text-sm text-slate-500">Available quantity</p></div>
            <Badge tone={status === 'In Stock' ? 'green' : status === 'Low Stock' ? 'orange' : 'red'}>{status}</Badge>
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-600">${Number(product.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <Button className="mt-5" disabled={product.quantity === 0} onClick={showRequestPlaceholder}>Request Product</Button>
        </SectionCard>;
      })}
    </section>}

    <section className="mt-7"><SectionCard title="Request Product Modal" subtitle="Product request remains a placeholder until Order Service integration."/></section>
  </>;
}

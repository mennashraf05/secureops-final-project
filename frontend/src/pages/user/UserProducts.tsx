import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../../api/orders';
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
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [requestQuantities, setRequestQuantities] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [submittingProductId, setSubmittingProductId] = useState<number | null>(null);
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

  function quantityFor(product: Product) {
    const value = Number(requestQuantities[product.id] || '1');
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(Math.floor(value), 1), product.quantity);
  }

  function setRequestQuantity(product: Product, value: string) {
    const nextValue = Number(value);
    if (value === '') {
      setRequestQuantities((current) => ({ ...current, [product.id]: value }));
      return;
    }
    if (!Number.isFinite(nextValue)) return;

    const clampedValue = Math.min(Math.max(Math.floor(nextValue), 1), product.quantity);
    setRequestQuantities((current) => ({ ...current, [product.id]: String(clampedValue) }));
  }

  async function requestProduct(product: Product) {
    setMessage('');
    setError('');

    if (product.quantity === 0) {
      setMessage('This product is currently out of stock.');
      return;
    }

    const requestedQuantity = quantityFor(product);
    setSubmittingProductId(product.id);
    try {
      await createOrder({
        items: [{
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: requestedQuantity,
        }],
      });
      setMessage('Product request submitted successfully.');
      window.setTimeout(() => navigate('/user/orders'), 700);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not submit product request.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setSubmittingProductId(null);
    }
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
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Quantity
              <input className="w-24 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800 outline-none ring-1 ring-slate-200" type="number" min="1" max={product.quantity} value={requestQuantities[product.id] || '1'} onChange={(event) => setRequestQuantity(product, event.target.value)} disabled={product.quantity === 0 || submittingProductId === product.id} />
            </label>
            <Button disabled={product.quantity === 0 || submittingProductId === product.id} onClick={() => void requestProduct(product)}>
              {submittingProductId === product.id ? 'Submitting...' : 'Request Product'}
            </Button>
          </div>
        </SectionCard>;
      })}
    </section>}
  </>;
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthContext';
import { createProduct, deleteProduct, getProducts, updateProduct, updateProductStock } from '../../api/products';
import type { Product, ProductCreate } from '../../types/product';

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  description: string;
  price: string;
  quantity: string;
};

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  category: '',
  description: '',
  price: '',
  quantity: '',
};

function stockStatus(quantity: number) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= 5) return 'Low Stock';
  return 'In Stock';
}

function money(value: string) {
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formToPayload(form: ProductForm): ProductCreate {
  return {
    name: form.name.trim(),
    sku: form.sku.trim(),
    category: form.category.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    quantity: Number(form.quantity),
  };
}

export default function Products() {
  const { logoutUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [deletedProducts, setDeletedProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  async function loadProducts() {
    setIsLoading(true);
    setError('');
    try {
      const data = await getProducts({ search, low_stock_only: lowStockOnly });
      setProducts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load products.';
      if (message === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProducts();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, lowStockOnly]);

  const metrics = useMemo(() => {
    const total = products.length;
    const low = products.filter((product) => product.quantity > 0 && product.quantity <= 5).length;
    const out = products.filter((product) => product.quantity === 0).length;
    const value = products.reduce((sum, product) => sum + Number(product.price) * product.quantity, 0);
    return { total, low, out, value };
  }, [products]);

  function setField(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(product: Product) {
    setEditingProduct(product);
    setIsProductFormOpen(true);
    setStockProduct(null);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description ?? '',
      price: String(product.price),
      quantity: String(product.quantity),
    });
  }

  function resetForm() {
    setEditingProduct(null);
    setForm(emptyForm);
  }

  function startAddProduct() {
    resetForm();
    setStockProduct(null);
    setError('');
    setSuccess('');
    setIsProductFormOpen(true);
  }

  function closeProductForm() {
    resetForm();
    setIsProductFormOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = formToPayload(form);
    if (!payload.name || !payload.sku || !payload.category) {
      setError('Name, SKU, and category are required.');
      return;
    }
    if (!Number.isFinite(payload.price) || !Number.isFinite(payload.quantity)) {
      setError('Price and quantity must be valid numbers.');
      return;
    }
    if (payload.price < 0 || payload.quantity < 0) {
      setError('Price and quantity cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = editingProduct
        ? await updateProduct(editingProduct.id, {
            name: payload.name,
            category: payload.category,
            description: payload.description,
            price: payload.price,
          })
        : await createProduct(payload);
      setSuccess(editingProduct ? response.message : 'Product added successfully.');
      closeProductForm();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product action failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockProduct) return;

    const quantity = Number(stockQuantity);
    if (quantity < 0) {
      setError('Quantity cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await updateProductStock(stockProduct.id, quantity);
      setSuccess(response.message);
      setStockProduct(null);
      setStockQuantity('');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock update failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    setError('');
    setSuccess('');
    setDeletingProductId(product.id);
    try {
      await deleteProduct(product.id);
      setSuccess('Product deleted successfully.');
      setDeletedProducts((current) => [product, ...current]);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingProductId(null);
    }
  }

  const rows = products.map((product) => [
    product.name,
    product.sku,
    product.category,
    product.quantity,
    money(product.price),
    stockStatus(product.quantity),
    <div className="flex min-w-[220px] flex-wrap gap-2">
      <button className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100" onClick={() => startEdit(product)}>Edit</button>
      <button className="rounded-xl bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100 transition hover:bg-cyan-100" onClick={() => { setStockProduct(product); setStockQuantity(String(product.quantity)); setEditingProduct(null); setIsProductFormOpen(false); }}>Stock</button>
      <button className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm shadow-red-600/20 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none" onClick={() => void handleDelete(product)} disabled={deletingProductId === product.id}>
        <Trash2 size={14}/> {deletingProductId === product.id ? 'Deleting...' : 'Delete'}
      </button>
    </div>,
    formatDate(product.updated_at),
  ]);

  return <>
    <PageHeader title="Inventory Management" subtitle="Control stock, pricing, product lifecycle, and inventory availability."/>
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, category..." className="w-full outline-none"/></div>
      <Button variant={lowStockOnly ? 'primary' : 'ghost'} onClick={() => setLowStockOnly((value) => !value)}><SlidersHorizontal size={17} className="mr-2 inline"/> {lowStockOnly ? 'Low Stock On' : 'Filters'}</Button>
      <Button onClick={startAddProduct}><Plus size={17} className="mr-2 inline"/> Add Product</Button>
    </div>

    {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {success && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div>}

    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Total Products" value={String(metrics.total)} trend="Live API"/>
      <KpiCard label="Low Stock Items" value={String(metrics.low)} trend="Needs review" tone="orange"/>
      <KpiCard label="Out of Stock" value={String(metrics.out)} trend="Critical" tone="red"/>
      <KpiCard label="Inventory Value" value={`$${Math.round(metrics.value).toLocaleString()}`} trend="Current stock" tone="green"/>
      <KpiCard label="Recently Updated" value={String(products.length)} trend="Synced" tone="cyan"/>
    </section>

    <section className="mt-7">
      <SectionCard title="Product Table" subtitle="Low stock rows are visually highlighted with progress-ready quantities.">
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading products...</p> : <DataTable columns={['Product','SKU','Category','Quantity','Price','Status','Actions','Last Updated']} rows={rows}/>}
      </SectionCard>
    </section>

    <section className="mt-7 grid gap-5 md:grid-cols-3">
      <SectionCard title={editingProduct ? 'Edit Product' : 'Add Product'} subtitle={editingProduct ? `Updating ${editingProduct.sku}` : 'Create a product with validation and audit logging'}>
        {isProductFormOpen ? <form onSubmit={handleSubmit} className="grid gap-3">
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Product name" value={form.name} onChange={(event) => setField('name', event.target.value)} />
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none disabled:text-slate-400" placeholder="SKU" value={form.sku} onChange={(event) => setField('sku', event.target.value)} disabled={Boolean(editingProduct)} />
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Category" value={form.category} onChange={(event) => setField('category', event.target.value)} />
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Description" value={form.description} onChange={(event) => setField('description', event.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField('price', event.target.value)} />
            <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none disabled:text-slate-400" placeholder="Quantity" type="number" min="0" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} disabled={Boolean(editingProduct)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingProduct ? 'Save Product' : 'Create Product'}</Button>
            <Button type="button" variant="ghost" onClick={closeProductForm}>Cancel</Button>
          </div>
        </form> : <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm leading-6 text-slate-500">Use Add Product to open the product form.</p>
        </div>}
      </SectionCard>

      <SectionCard title="Update Stock Modal" subtitle="Quantity update with audit trail preview">
        {stockProduct ? <form onSubmit={handleStockSubmit} className="grid gap-3">
          <p className="text-sm font-semibold text-slate-600">{stockProduct.name}</p>
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" type="number" min="0" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>Update Stock</Button>
            <Button type="button" variant="ghost" onClick={() => setStockProduct(null)}>Cancel</Button>
          </div>
        </form> : <p className="text-sm text-slate-500">Choose Stock from a product row to update quantity.</p>}
      </SectionCard>

      <SectionCard title="Delete Confirmation" subtitle="Critical action confirmation and error state">
        {deletedProducts.length > 0 ? <div className="space-y-3">
          <p className="text-sm font-bold text-red-700">Deleted products in this session</p>
          <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
            {deletedProducts.map((product) => <div key={`${product.id}-${product.sku}`} className="rounded-2xl bg-red-50 p-4">
              <p className="text-base font-extrabold text-slate-950">{product.name}</p>
              <p className="mt-1 text-sm text-slate-600">{product.sku} - {product.category}</p>
              <p className="mt-2 text-xs font-semibold text-red-600">Removed from inventory successfully.</p>
            </div>)}
          </div>
        </div> : <p className="text-sm leading-6 text-slate-500">Delete products from the table to show their details here after confirmation.</p>}
      </SectionCard>
    </section>
  </>;
}

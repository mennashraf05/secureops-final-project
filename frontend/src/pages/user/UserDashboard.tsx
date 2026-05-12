import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders } from '../../api/orders';
import { getProducts } from '../../api/products';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { Order, OrderStatus } from '../../types/order';
import type { Product } from '../../types/product';

function stockStatus(quantity: number) {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= 5) return 'Low Stock';
  return 'In Stock';
}

function statusTone(status: OrderStatus) {
  if (status === 'approved') return 'green' as const;
  if (status === 'rejected') return 'red' as const;
  return 'orange' as const;
}

function formatOrderProducts(order: Order) {
  return order.items.map((item) => item.product_name).join(', ') || 'No items';
}

export default function UserDashboard() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    setError('');
    try {
      const [productData, orderData] = await Promise.all([
        getProducts(),
        getMyOrders(),
      ]);
      setProducts(productData);
      setOrders(orderData);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load dashboard data.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const pendingCount = useMemo(() => orders.filter((order) => order.status === 'pending').length, [orders]);
  const approvedCount = useMemo(() => orders.filter((order) => order.status === 'approved').length, [orders]);
  const rejectedCount = useMemo(() => orders.filter((order) => order.status === 'rejected').length, [orders]);
  const availableQuantity = useMemo(
    () => products.reduce((total, product) => total + Math.max(product.quantity, 0), 0),
    [products],
  );

  const recentProducts = useMemo(
    () => products.slice(0, 3).map((product) => [
      product.name,
      product.sku,
      product.quantity,
      stockStatus(product.quantity),
    ]),
    [products],
  );

  const recentOrders = useMemo(
    () => orders.slice(0, 3).map((order) => [
      `#${order.id}`,
      formatOrderProducts(order),
      <Badge tone={statusTone(order.status)}>{order.status}</Badge>,
      order.admin_response || 'Pending admin response',
    ]),
    [orders],
  );

  return (
    <>
      <PageHeader title="My Inventory Portal" subtitle="View available products, submit stock requests, and track your order status." />

      <section className="mb-7 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-card">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-600">Account role: User</p>
        <h2 className="mt-2 text-3xl font-extrabold">Welcome to your secure inventory workspace.</h2>
        <p className="mt-2 text-slate-500">Your access is limited by role-based permissions. Admin security tools are hidden.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => navigate('/user/products')}>Request Product</Button>
          <Button variant="ghost" onClick={() => void loadDashboard()} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </section>

      {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <section className="grid gap-5 md:grid-cols-5">
        <KpiCard label="My Pending Requests" value={isLoading ? '...' : String(pendingCount)} trend="Waiting" tone="orange" />
        <KpiCard label="My Approved Orders" value={isLoading ? '...' : String(approvedCount)} trend="Active" tone="green" />
        <KpiCard label="My Rejected Orders" value={isLoading ? '...' : String(rejectedCount)} trend="Review" tone="red" />
        <KpiCard label="Available Products" value={isLoading ? '...' : String(availableQuantity)} trend="Browse" />
        <KpiCard label="Shared Files" value="0" trend="Coming soon" tone="cyan" />
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-3">
        <SectionCard title="Recent Products" subtitle="Live inventory items available through the Products API.">
          {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading products...</p> : null}
          {!isLoading && recentProducts.length === 0 ? <p className="text-sm font-semibold text-slate-500">No products are available yet.</p> : null}
          {!isLoading && recentProducts.length > 0 ? (
            <DataTable columns={['Product', 'SKU', 'Available', 'Status']} rows={recentProducts} />
          ) : null}
        </SectionCard>

        <SectionCard title="My Recent Orders" subtitle="Only your submitted product requests are shown.">
          {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading orders...</p> : null}
          {!isLoading && recentOrders.length === 0 ? <p className="text-sm font-semibold text-slate-500">You have not submitted any product requests yet.</p> : null}
          {!isLoading && recentOrders.length > 0 ? (
            <DataTable columns={['Order ID', 'Product', 'Status', 'Response']} rows={recentOrders} />
          ) : null}
        </SectionCard>

        <SectionCard title="Shared Files" subtitle="Secure File Vault is not implemented for user downloads yet.">
          <DataTable
            columns={['File', 'Type', 'Integrity', 'Action']}
            rows={[['No shared files API', 'Coming soon', 'Not available', 'Disabled']]}
          />
        </SectionCard>
      </section>
    </>
  );
}

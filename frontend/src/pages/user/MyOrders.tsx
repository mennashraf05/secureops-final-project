import { useEffect, useMemo, useState } from 'react';
import { getMyOrders } from '../../api/orders';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Order, OrderStatus } from '../../types/order';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusTone(status: OrderStatus) {
  if (status === 'approved') return 'green' as const;
  if (status === 'rejected') return 'red' as const;
  return 'orange' as const;
}

function orderItems(order: Order) {
  return <div className="space-y-1">
    {order.items.map((item) => <div key={item.id}>
      <div className="font-semibold text-slate-800">{item.product_name}</div>
      <div className="text-xs text-slate-500">{item.product_sku}</div>
    </div>)}
  </div>;
}

function orderQuantities(order: Order) {
  return <div className="space-y-1">
    {order.items.map((item) => <div key={item.id}>{item.quantity}</div>)}
  </div>;
}

export default function MyOrders() {
  const { logoutUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadOrders() {
    setIsLoading(true);
    setError('');
    try {
      setOrders(await getMyOrders());
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load orders.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const rows = useMemo(() => orders.map((order) => [
    `#${order.id}`,
    orderItems(order),
    orderQuantities(order),
    <Badge tone={statusTone(order.status)}>{order.status}</Badge>,
    formatDate(order.created_at),
    order.admin_response || 'Pending admin response',
  ]), [orders]);

  return <>
    <PageHeader title="My Orders" subtitle="Track your submitted inventory requests and approval status."/>

    <SectionCard title="My Orders Only" subtitle="Normal users can only see their own requests.">
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" onClick={() => void loadOrders()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
      </div>

      {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading your orders...</p> : null}
      {!isLoading && !error && orders.length === 0 ? <p className="text-sm font-semibold text-slate-500">You have not submitted any product requests yet.</p> : null}
      {!isLoading && orders.length > 0 ? <DataTable columns={['Order ID','Product','Quantity','Status','Date','Admin Response']} rows={rows}/> : null}
    </SectionCard>

    <section className="mt-7 grid gap-5 md:grid-cols-2">
      <SectionCard title="Order Details" subtitle="Each request shows submitted items, quantities, status, and admin response."/>
      <SectionCard title="Empty State" subtitle="Shown when you have not submitted any requests."/>
    </section>
  </>;
}

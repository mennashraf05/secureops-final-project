import { useEffect, useMemo, useState } from 'react';
import { approveOrder, getAllOrders, rejectOrder } from '../../api/orders';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Order, OrderStatus } from '../../types/order';

type FilterValue = 'all' | OrderStatus;

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

function orderUser(order: Order) {
  const name = order.user_name?.trim();
  const email = order.user_email?.trim();

  if (!name && !email) {
    return <span>User #{order.user_id}</span>;
  }

  return <div>
    <div className="font-semibold text-slate-800">{name || email}</div>
    {email && email !== name ? <div className="text-xs text-slate-500">{email}</div> : null}
    <div className="text-xs text-slate-400">User #{order.user_id}</div>
  </div>;
}

export default function Orders() {
  const { logoutUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadOrders() {
    setIsLoading(true);
    setError('');
    try {
      setOrders(await getAllOrders(statusFilter === 'all' ? undefined : { status: statusFilter }));
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
  }, [statusFilter]);

  async function approve(id: number) {
    setMessage('');
    setError('');
    setActionOrderId(id);
    try {
      await approveOrder(id);
      setMessage('Order approved successfully.');
      await loadOrders();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not approve order.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setActionOrderId(null);
    }
  }

  async function reject() {
    if (!rejectOrderId) return;

    const reason = rejectReason.trim();
    if (!reason) {
      setError('Please enter a rejection reason.');
      return;
    }

    setMessage('');
    setError('');
    setActionOrderId(rejectOrderId);
    try {
      await rejectOrder(rejectOrderId, reason);
      setMessage('Order rejected successfully.');
      setRejectOrderId(null);
      setRejectReason('');
      await loadOrders();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not reject order.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setActionOrderId(null);
    }
  }

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    approved: orders.filter((order) => order.status === 'approved').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  }), [orders]);

  const rows = useMemo(() => orders.map((order) => [
    `#${order.id}`,
    orderUser(order),
    orderItems(order),
    orderQuantities(order),
    <Badge tone={statusTone(order.status)}>{order.status}</Badge>,
    formatDate(order.created_at),
    order.admin_response || 'No response yet',
    order.status === 'pending' ? <div className="flex flex-wrap gap-2">
      <Button onClick={() => void approve(order.id)} disabled={actionOrderId === order.id}>
        {actionOrderId === order.id ? 'Working...' : 'Approve'}
      </Button>
      <Button variant="danger" onClick={() => { setRejectOrderId(order.id); setRejectReason(''); setMessage(''); setError(''); }} disabled={actionOrderId === order.id}>Reject</Button>
    </div> : 'No action',
  ]), [actionOrderId, orders]);

  return <>
    <PageHeader title="Order Management" subtitle="Track stock requests, approvals, rejections, and fulfillment status."/>

    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Total Orders" value={String(counts.total)} trend="Live" />
      <KpiCard label="Pending Orders" value={String(counts.pending)} trend="Review" tone="orange"/>
      <KpiCard label="Approved Orders" value={String(counts.approved)} trend="Healthy" tone="green"/>
      <KpiCard label="Rejected Orders" value={String(counts.rejected)} trend="Needs review" tone="red"/>
      <KpiCard label="Completed Orders" value={String(counts.approved + counts.rejected)} trend="Decided" tone="cyan"/>
    </section>

    <section className="mt-7">
      <SectionCard title="Orders Table" subtitle="Includes status filter, request items, admin response, and approval actions.">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="ghost" onClick={() => void loadOrders()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
        </div>

        {message && <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading orders...</p> : null}
        {!isLoading && !error && orders.length === 0 ? <p className="text-sm font-semibold text-slate-500">No orders match this filter.</p> : null}
        {!isLoading && orders.length > 0 ? <DataTable columns={['Order ID','User','Product','Quantity','Status','Date','Admin Response','Actions']} rows={rows}/> : null}
      </SectionCard>
    </section>

    <section className="mt-7 grid gap-5 lg:grid-cols-3">
      <SectionCard title="Order Details Drawer" subtitle="Timeline, requester info, product availability"/>
      <SectionCard title="Approval Modal" subtitle="Approve pending orders from the live table."><Button disabled>Approve Selected Order</Button></SectionCard>
      <SectionCard title="Rejection Modal" subtitle="Reason field is saved as the admin response.">
        {rejectOrderId ? <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-600">Reject order #{rejectOrderId}</p>
          <textarea className="min-h-28 w-full rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-1 ring-slate-200" placeholder="Reason for rejection" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void reject()} disabled={actionOrderId === rejectOrderId}>{actionOrderId === rejectOrderId ? 'Rejecting...' : 'Reject With Reason'}</Button>
            <Button variant="ghost" onClick={() => { setRejectOrderId(null); setRejectReason(''); }}>Cancel</Button>
          </div>
        </div> : <Button variant="danger" disabled>Reject With Reason</Button>}
      </SectionCard>
    </section>
  </>;
}

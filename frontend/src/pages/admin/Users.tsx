import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { createUser, deleteUser, getUsers } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/layout/Page';
import { KpiCard } from '../../components/cards/KpiCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { AuthUser, UserRole } from '../../api/client';

type RoleFilter = 'all' | UserRole;
type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'user',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function roleTone(role: UserRole) {
  return role === 'admin' ? 'violet' as const : 'blue' as const;
}

export default function Users() {
  const { logoutUser, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadUsers() {
    setIsLoading(true);
    setError('');
    try {
      setUsers(await getUsers());
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load users.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  function setField<K extends keyof UserForm>(field: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setMessage(response.message);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not create user.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(targetUser: AuthUser) {
    if (targetUser.id === currentUser?.id) {
      setError('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Delete ${targetUser.name} (${targetUser.role})?`)) return;

    setError('');
    setMessage('');
    setDeletingUserId(targetUser.id);
    try {
      const response = await deleteUser(targetUser.id);
      setMessage(response.message);
      await loadUsers();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not delete user.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setError(nextError);
    } finally {
      setDeletingUserId(null);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query
        || user.name.toLowerCase().includes(query)
        || user.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const metrics = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    normal: users.filter((user) => user.role === 'user').length,
    active: users.filter((user) => user.is_active).length,
  }), [users]);

  const rows = useMemo(() => filteredUsers.map((user) => [
    `#${user.id}`,
    user.name,
    user.email,
    <Badge tone={roleTone(user.role)}>{user.role}</Badge>,
    <Badge tone={user.is_active ? 'green' : 'red'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>,
    formatDate(user.created_at),
    user.id === currentUser?.id ? <span className="text-sm font-semibold text-slate-400">Current admin</span> : <Button variant="danger" onClick={() => void handleDelete(user)} disabled={deletingUserId === user.id}>
      <Trash2 size={16} className="mr-2 inline"/>{deletingUserId === user.id ? 'Deleting...' : 'Delete'}
    </Button>,
  ]), [currentUser?.id, deletingUserId, filteredUsers]);

  return <>
    <PageHeader title="User Management" subtitle="Manage and review registered platform users."/>

    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Users" value={String(metrics.total)} trend="Registered"/>
      <KpiCard label="Admin Users" value={String(metrics.admins)} trend="Privileged" tone="violet"/>
      <KpiCard label="Normal Users" value={String(metrics.normal)} trend="Standard" tone="cyan"/>
      <KpiCard label="Active Users" value={String(metrics.active)} trend="Enabled" tone="green"/>
    </section>

    <section className="mt-7">
      <SectionCard title="Users Table" subtitle="Safe account overview without password hashes.">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200">
            <Search size={18}/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." className="w-full outline-none"/>
          </div>
          <select className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card outline-none ring-1 ring-slate-200" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>

        {message && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading users...</p> : null}
        {!isLoading && !error && filteredUsers.length === 0 ? <p className="text-sm font-semibold text-slate-500">No users match the current filters.</p> : null}
        {!isLoading && filteredUsers.length > 0 ? <DataTable columns={['User ID','Name','Email','Role','Status','Created Date','Actions']} rows={rows}/> : null}
      </SectionCard>
    </section>

    <section className="mt-7">
      <SectionCard title="Add User" subtitle="Create a normal user or admin account.">
        <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_160px_auto]">
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Full name" value={form.name} onChange={(event) => setField('name', event.target.value)} />
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Email address" type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
          <input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Password" type="password" value={form.password} onChange={(event) => setField('password', event.target.value)} />
          <select className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 outline-none" value={form.role} onChange={(event) => setField('role', event.target.value as UserRole)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={isSubmitting}>
            <Plus size={17} className="mr-2 inline"/>{isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </SectionCard>
    </section>
  </>;
}

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
export function AppLayout({ role }: { role: 'admin'|'user' }) {
  return <div className="min-h-screen bg-slate-50"><Sidebar role={role}/><Topbar title={role === 'admin' ? 'Admin Console' : 'User Portal'}/><main className="px-5 py-8 lg:ml-72 lg:px-8"><Outlet/></main></div>;
}

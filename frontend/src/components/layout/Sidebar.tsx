import { NavLink } from 'react-router-dom';
import { Activity, Archive, Boxes, ClipboardList, FileLock2, FileText, LayoutDashboard, Network, Settings, ShieldAlert, Swords, User, UserCircle, Users } from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '../../utils/cn';

const adminItems = [
  ['Dashboard','/admin/dashboard',LayoutDashboard], ['Users','/admin/users',Users], ['Products','/admin/products',Boxes], ['Orders','/admin/orders',ClipboardList], ['Secure File Vault','/admin/vault',FileLock2], ['Reports','/admin/reports',FileText], ['Security Center','/admin/security',ShieldAlert], ['Attack Simulation','/admin/attack-simulation',Swords], ['Audit Logs','/admin/audit-logs',Activity], ['Architecture','/admin/architecture',Network], ['Settings','/admin/settings',Settings]
] as const;
const userItems = [['My Dashboard','/user/dashboard',LayoutDashboard], ['Products','/user/products',Boxes], ['My Orders','/user/orders',Archive], ['My Files','/user/files',FileLock2], ['Profile','/user/profile',UserCircle]] as const;
export function Sidebar({ role }: { role: 'admin'|'user' }) {
  const items = role === 'admin' ? adminItems : userItems;
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto bg-gradient-to-b from-navy to-ink p-5 text-white shadow-2xl lg:flex">
    <Logo />
    <nav className="mt-10 space-y-2">{items.map(([label,path,Icon]) => <NavLink key={path} to={path} className={({isActive}) => cn('group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition', isActive ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-glow' : 'hover:bg-white/8 hover:text-white')}>
      <Icon size={18}/><span>{label}</span>
    </NavLink>)}</nav>
    <div className="mt-auto rounded-3xl border border-cyan-400/20 bg-white/5 p-4"><div className="flex items-center gap-2 text-sm font-bold text-cyan-200"><User size={16}/> {role === 'admin' ? 'Admin Access' : 'User Access'}</div><p className="mt-2 text-xs leading-5 text-slate-400">Role-based navigation is active. Restricted screens stay hidden.</p></div>
  </aside>;
}

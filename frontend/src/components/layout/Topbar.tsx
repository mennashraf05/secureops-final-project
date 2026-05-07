import { Bell, Menu, Search } from 'lucide-react';
import { Badge } from '../ui/Badge';
export function Topbar({ title='SecureOps' }: { title?: string }) {
  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl lg:ml-72">
    <div className="flex h-20 items-center justify-between gap-4 px-5 lg:px-8">
      <div className="flex items-center gap-3"><button className="rounded-xl bg-slate-100 p-2 lg:hidden"><Menu size={20}/></button><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p><div className="mt-1 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500"><Search size={16}/> Search inventory, events, files...</div></div></div>
      <div className="flex items-center gap-3"><Badge tone="green"><span className="mr-1 h-2 w-2 animate-pulseSoft rounded-full bg-emerald-500"/> All Systems Operational</Badge><button className="rounded-2xl bg-slate-100 p-3"><Bell size={18}/></button><div className="hidden rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:block">Admin Profile</div></div>
    </div>
  </header>;
}

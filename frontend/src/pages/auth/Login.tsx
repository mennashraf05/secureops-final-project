import { Link, useNavigate } from 'react-router-dom';
import { Eye, Lock, Mail, Network, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-ink to-blue-950 p-8 text-white lg:p-14">
      <div className="absolute inset-0 grid-bg opacity-60"/><div className="relative"><Logo/><div className="mt-24 max-w-xl"><h1 className="text-5xl font-extrabold leading-tight">Secure Distributed Inventory Management</h1><p className="mt-5 text-lg leading-8 text-cyan-100/80">A premium platform for inventory operations, risk monitoring, audit tracking, and security intelligence.</p></div>
      <div className="mt-12 grid gap-4">{[['Multi-layer Security','JWT, RBAC, OAuth, audit logs'],['Distributed Architecture','Nginx, PostgreSQL, RabbitMQ, worker services'],['Risk Monitoring','Security Center, attack simulation, risk scoring']].map(([a,b])=><div key={a} className="dark-glass rounded-3xl p-5"><div className="flex gap-3"><ShieldCheck className="text-cyan-300"/><div><p className="font-bold">{a}</p><p className="text-sm text-slate-300">{b}</p></div></div></div>)}</div></div>
    </section>
    <section className="grid place-items-center p-6"><div className="glass w-full max-w-md rounded-[2rem] p-8 shadow-card"><h2 className="text-3xl font-extrabold">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Use mock login buttons to enter the demo.</p>
      <div className="mt-8 space-y-4"><label className="block"><span className="text-sm font-semibold text-slate-600">Email</span><div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3"><Mail size={18}/><input className="w-full bg-transparent outline-none" placeholder="admin@secureops.test"/></div></label><label className="block"><span className="text-sm font-semibold text-slate-600">Password</span><div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3"><Lock size={18}/><input className="w-full bg-transparent outline-none" type="password" placeholder="••••••••"/><Eye size={18}/></div></label></div>
      <div className="mt-5 flex items-center justify-between text-sm"><label className="flex gap-2"><input type="checkbox"/> Remember me</label><a className="font-semibold text-blue-600">Forgot password?</a></div>
      <div className="mt-7 grid gap-3"><Button onClick={()=>navigate('/admin/dashboard')}>Login as Admin</Button><Button variant="ghost" onClick={()=>navigate('/user/dashboard')}>Login as User</Button><Button variant="dark"><ShieldCheck size={17} className="mr-2 inline"/> Continue with GitHub</Button></div>
      <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-700"><Network size={16} className="mr-2 inline"/> Protected with JWT authentication and role-based authorization</div><p className="mt-5 text-center text-sm text-slate-500">No account? <Link className="font-bold text-blue-600" to="/register">Register</Link></p>
    </div></section>
  </main>;
}

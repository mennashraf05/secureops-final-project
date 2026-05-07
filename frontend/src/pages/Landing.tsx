import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileLock2, Network, Rabbit, ShieldCheck, ShieldAlert, Swords, ScrollText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/layout/Logo';

const features = [
  ['API Gateway', Network], ['JWT Authentication', ShieldCheck], ['RBAC Authorization', ShieldAlert], ['Secure File Vault', FileLock2],
  ['RabbitMQ Jobs', Rabbit], ['Audit Logs', ScrollText], ['Security Center', ShieldAlert], ['Attack Simulation', Swords]
];
export default function Landing() {
  return <main className="min-h-screen overflow-hidden bg-gradient-to-br from-navy via-ink to-slate-950 text-white">
    <div className="absolute inset-0 grid-bg opacity-50" />
    <div className="relative mx-auto max-w-7xl px-6 py-8">
      <nav className="flex items-center justify-between"><Logo/><div className="flex gap-3"><Link to="/login"><Button variant="ghost">Login</Button></Link></div></nav>
      <section className="grid min-h-[720px] items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}}>
          <div className="mb-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">University Final Project • Premium SaaS Demo</div>
          <h1 className="max-w-4xl text-5xl font-extrabold leading-tight md:text-7xl">Secure Distributed Inventory Platform with Built‑in Risk Monitoring</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Inventory operations, authentication, audit logging, RabbitMQ jobs, secure file vault, and attack simulation in one premium distributed system.</p>
        </motion.div>
        <motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} className="relative rounded-[2rem] border border-cyan-400/20 bg-white/10 p-5 shadow-glow backdrop-blur-xl">
          <div className="rounded-[1.5rem] bg-slate-950/80 p-5">
            <div className="mb-5 flex items-center justify-between"><span className="font-bold text-cyan-200">Live Security Command View</span><span className="h-3 w-3 animate-pulseSoft rounded-full bg-emerald-400" /></div>
            <div className="grid gap-4 sm:grid-cols-2">{features.map(([name,Icon]) => <div key={name as string} className="rounded-3xl border border-white/10 bg-white/5 p-5"><Icon className="text-cyan-300"/><p className="mt-4 font-bold">{name as string}</p><p className="mt-1 text-sm text-slate-400">Demo-ready module</p></div>)}</div>
          </div>
        </motion.div>
      </section>
    </div>
  </main>;
}

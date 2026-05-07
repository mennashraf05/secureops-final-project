import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '../ui/Badge';

const accent: Record<string, string> = {
  blue: 'from-blue-600 to-cyan-400', cyan: 'from-cyan-500 to-blue-500', violet: 'from-violet-600 to-cyan-400',
  orange: 'from-amber-500 to-orange-400', red: 'from-red-600 to-orange-400', green: 'from-emerald-500 to-cyan-400'
};
export function KpiCard({ label, value, trend, tone='blue' }: { label: string; value: string; trend: string; tone?: string }) {
  return (
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} whileHover={{y:-5}} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent[tone] ?? accent.blue}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl bg-gradient-to-br ${accent[tone] ?? accent.blue} p-3 text-white shadow-glow`}><ArrowUpRight size={20}/></div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Badge tone={tone === 'red' ? 'red' : tone === 'orange' ? 'orange' : 'blue'}>{trend}</Badge>
        <div className="flex h-8 items-end gap-1.5">
          {[20,28,16,34,24,38].map((h,i)=><span key={i} style={{height:h}} className={`w-1.5 rounded-full bg-gradient-to-t ${accent[tone] ?? accent.blue} opacity-70`} />)}
        </div>
      </div>
    </motion.div>
  );
}

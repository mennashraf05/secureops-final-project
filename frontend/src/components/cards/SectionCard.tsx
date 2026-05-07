import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
export function SectionCard({ title, subtitle, children, className='', dark=false }: { title: string; subtitle?: string; children?: React.ReactNode; className?: string; dark?: boolean }) {
  return <motion.section initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} whileHover={{y:-3}} className={cn('rounded-3xl border p-6 shadow-card', dark ? 'border-cyan-400/20 bg-slate-950 text-white' : 'border-slate-200 bg-white', className)}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <div><h3 className={cn('text-lg font-bold', dark ? 'text-white' : 'text-slate-950')}>{title}</h3>{subtitle && <p className={cn('mt-1 text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>{subtitle}</p>}</div>
      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 shadow-glow" />
    </div>
    {children}
  </motion.section>
}

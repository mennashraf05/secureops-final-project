import { cn } from '../../utils/cn';

type Tone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'violet' | 'gray';
const tones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  orange: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100 shadow-[0_0_22px_rgba(220,38,38,.18)]',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
};
export function Badge({ children, tone = 'gray', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1', tones[tone], className)}>{children}</span>;
}

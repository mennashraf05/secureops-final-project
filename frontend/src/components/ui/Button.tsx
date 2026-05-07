import { cn } from '../../utils/cn';
export function Button({ children, variant='primary', className='', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'ghost'|'danger'|'dark' }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20',
    ghost: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20',
    dark: 'bg-slate-900 text-white hover:bg-slate-800',
  }[variant];
  return <button className={cn('rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-100', styles, className)} {...props}>{children}</button>;
}

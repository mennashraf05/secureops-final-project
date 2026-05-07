import { Badge } from '../ui/Badge';
import type { ReactNode } from 'react';

function toneFor(value: string) {
  const v = value.toLowerCase();
  if (v.includes('critical') || v.includes('blocked') || v.includes('failed') || v.includes('out')) return 'red' as const;
  if (v.includes('high') || v.includes('low stock') || v.includes('pending') || v.includes('processing')) return 'orange' as const;
  if (v.includes('success') || v.includes('completed') || v.includes('verified') || v.includes('approved') || v.includes('in stock')) return 'green' as const;
  if (v.includes('medium')) return 'cyan' as const;
  return 'gray' as const;
}
export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return <div className="overflow-x-auto no-scrollbar">
    <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
      <thead><tr>{columns.map(col => <th key={col} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{col}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className="group rounded-2xl bg-slate-50 transition hover:bg-blue-50/60">
        {row.map((cell, i) => <td key={i} className="px-4 py-3 font-medium text-slate-700 first:rounded-l-2xl last:rounded-r-2xl">
          {typeof cell === 'string' && ['Status','Severity','Integrity','Encryption','Priority'].some(x => columns[i]?.includes(x)) ? <Badge tone={toneFor(cell)}>{cell}</Badge> : cell}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

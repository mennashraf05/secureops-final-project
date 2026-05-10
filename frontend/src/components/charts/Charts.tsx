import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { riskTrend } from '../../data/mockData';

type RiskPoint = { label?: string; name?: string; risk_score?: number; score?: number };
type EventPoint = { label?: string; name?: string; total?: number; events?: number; success?: number; failure?: number; blocked?: number; info?: number };
type BreakdownPoint = { label?: string; name?: string; value: number };

function emptyState() {
  return <div className="grid h-[220px] place-items-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-500">No chart data available.</div>;
}

export function RiskLineChart({ data }: { data?: RiskPoint[] }) {
  const chartData = data?.length ? data.map((point) => ({ name: point.label ?? point.name, score: point.risk_score ?? point.score ?? 0 })) : riskTrend;
  if (!chartData.length) return emptyState();
  return <ResponsiveContainer width="100%" height={240}><AreaChart data={chartData}><defs><linearGradient id="risk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38BDF8" stopOpacity={.45}/><stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#64748B" fontSize={12}/><YAxis stroke="#64748B" fontSize={12}/><Tooltip/><Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={3} fill="url(#risk)"/></AreaChart></ResponsiveContainer>;
}
export function EventsBarChart({ data }: { data?: EventPoint[] }) {
  const chartData = data?.length ? data.map((point) => ({ name: point.label ?? point.name, events: point.total ?? point.events ?? 0 })) : riskTrend;
  if (!chartData.length) return emptyState();
  return <ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#64748B" fontSize={12}/><YAxis stroke="#64748B" fontSize={12}/><Tooltip/><Bar dataKey="events" fill="#06B6D4" radius={[10,10,0,0]}/></BarChart></ResponsiveContainer>;
}
export function SeverityPie({ data }: { data?: BreakdownPoint[] }) {
  const colors: Record<string, string> = { Low: '#16A34A', Medium: '#F59E0B', High: '#DC2626', Critical: '#991B1B' };
  const chartData = data?.length ? data.map((point) => ({ name: point.label ?? point.name ?? 'Unknown', value: point.value, color: colors[point.label ?? point.name ?? ''] ?? '#64748B' })) : [{name:'Low', value: 28, color:'#16A34A'}, {name:'Medium', value: 34, color:'#F59E0B'}, {name:'High', value: 22, color:'#DC2626'}, {name:'Critical', value: 16, color:'#991B1B'}];
  if (!chartData.some((point) => point.value > 0)) return emptyState();
  return <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" outerRadius={82}>{chartData.map((d)=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>;
}

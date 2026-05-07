import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { riskTrend } from '../../data/mockData';

export function RiskLineChart() {
  return <ResponsiveContainer width="100%" height={240}><AreaChart data={riskTrend}><defs><linearGradient id="risk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38BDF8" stopOpacity={.45}/><stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#64748B" fontSize={12}/><YAxis stroke="#64748B" fontSize={12}/><Tooltip/><Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={3} fill="url(#risk)"/></AreaChart></ResponsiveContainer>;
}
export function EventsBarChart() {
  return <ResponsiveContainer width="100%" height={240}><BarChart data={riskTrend}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/><XAxis dataKey="name" stroke="#64748B" fontSize={12}/><YAxis stroke="#64748B" fontSize={12}/><Tooltip/><Bar dataKey="events" fill="#06B6D4" radius={[10,10,0,0]}/></BarChart></ResponsiveContainer>;
}
export function SeverityPie() {
  const data = [{name:'Low', value: 28, color:'#16A34A'}, {name:'Medium', value: 34, color:'#F59E0B'}, {name:'High', value: 22, color:'#DC2626'}, {name:'Critical', value: 16, color:'#991B1B'}];
  return <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={82}>{data.map((d)=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>;
}

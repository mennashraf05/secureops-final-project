import { ShieldAlert, Swords } from 'lucide-react';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';

const plannedScenarios = [
  'Authentication abuse checks',
  'Authorization bypass attempts',
  'File security validation',
  'Rate limiting validation',
  'Internal service protection checks',
];

export default function AttackSimulation() {
  return <>
    <PageHeader title="Attack Simulation Lab" subtitle="Run controlled attack scenarios to validate authentication, authorization, file security, rate limiting, and internal service protection."/>
    <SectionCard title="Controlled Security Validation" subtitle="Backend integration required before simulations can run." dark>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white/10 p-4 text-sm font-semibold text-cyan-50 ring-1 ring-white/15">
          Attack Simulation backend will be available after Attack Simulation integration.
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled>Run All Simulations</Button>
          <Button variant="dark" disabled>Clear Results</Button>
          <Button variant="danger" disabled>Export Simulation Report</Button>
        </div>
      </div>
    </SectionCard>
    <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {plannedScenarios.map((scenario) => <SectionCard key={scenario} title={scenario} subtitle="Coming after backend integration.">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 ring-1 ring-blue-100">
            {scenario.includes('File') ? <ShieldAlert size={22}/> : <Swords size={22}/>}
          </div>
          <p className="text-sm leading-6 text-slate-500">This scenario is intentionally inactive until the Attack Simulation backend is implemented.</p>
        </div>
        <Button className="mt-4" variant="ghost" disabled>Run</Button>
      </SectionCard>)}
    </section>
  </>;
}

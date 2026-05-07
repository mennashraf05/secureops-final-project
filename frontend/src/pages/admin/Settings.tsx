import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
const sections = ['Profile Settings','Security Settings','Notification Preferences','API / Internal Service Settings','Rate Limit Settings','File Upload Policy','OAuth Settings','Secrets Management Placeholder','Theme Preference','System Preferences'];
export default function Settings() {
 return <><PageHeader title="Settings" subtitle="Manage security, platform, notification, and service configuration."/>
 <section className="grid gap-5 lg:grid-cols-2">{sections.map((s,i)=><SectionCard key={s} title={s} subtitle="Editable configuration block"><div className="grid gap-3"><input className="rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder={`${s} value`}/><label className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-semibold">Enabled <input type="checkbox" defaultChecked={i%2===0}/></label></div></SectionCard>)}</section><section className="mt-7 rounded-3xl border border-red-200 bg-red-50 p-6"><h3 className="font-extrabold text-red-700">Danger Zone</h3><p className="mt-1 text-sm text-red-600">Reset secrets, revoke OAuth clients, or disable internal services.</p><Button variant="danger" className="mt-4">Save Changes</Button></section>
 </>;
}

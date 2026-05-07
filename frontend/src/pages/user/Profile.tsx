import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
export default function Profile() {
 return <><PageHeader title="My Profile" subtitle="Manage your account details, password, and login activity."/>
 <section className="grid gap-6 xl:grid-cols-2"><SectionCard title="Profile Information" subtitle="Role: User"><div className="grid gap-3"><input className="rounded-2xl bg-slate-100 px-4 py-3" defaultValue="Demo User"/><input className="rounded-2xl bg-slate-100 px-4 py-3" defaultValue="user@secureops.test"/><Button>Save Changes</Button></div></SectionCard><SectionCard title="Password Change" subtitle="Validation rules included"><div className="grid gap-3"><input className="rounded-2xl bg-slate-100 px-4 py-3" placeholder="Current password"/><input className="rounded-2xl bg-slate-100 px-4 py-3" placeholder="New password"/><Button variant="dark">Update Password</Button></div></SectionCard></section>
 <section className="mt-7 grid gap-6 xl:grid-cols-2"><SectionCard title="Recent Login Activity" subtitle="Last login: Today • IP: 10.0.0.15"/><SectionCard title="Logout" subtitle="End current demo session"><Button variant="danger">Logout</Button></SectionCard></section>
 </>;
}

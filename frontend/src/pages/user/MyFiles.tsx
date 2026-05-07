import { files } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
export default function MyFiles() {
 return <><PageHeader title="My Shared Files" subtitle="Access documents shared with you securely."/>
 <SectionCard title="Shared Files Table" subtitle="Users cannot upload, delete, or verify system files unless allowed."><DataTable columns={['File Name','Type','Size','Shared By','Integrity Status','Date Shared','Actions']} rows={files.filter(f=>f.integrity==='Verified').map(f=>[f.name,f.type,f.size,f.by,f.integrity,f.date,'Download • Metadata'])}/></SectionCard>
 </>;
}

import { FileLock2, UploadCloud } from 'lucide-react';
import { files } from '../../data/mockData';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
export default function SecureFileVault() {
 return <><PageHeader title="Secure File Vault" subtitle="Upload, validate, encrypt, verify, and manage sensitive inventory documents."/>
 <section className="mb-7 rounded-[2rem] bg-gradient-to-br from-navy to-blue-900 p-7 text-white shadow-glow"><FileLock2 className="text-cyan-300"/><h2 className="mt-4 text-3xl font-extrabold">Every file is validated, encrypted, hashed, and access-controlled.</h2><div className="mt-6 flex flex-wrap gap-3">{['Validate','Encrypt','Store','Verify','Authorized Download'].map((x,i)=><Badge key={x} tone={i===4?'green':'cyan'}>{x}</Badge>)}</div></section>
 <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><SectionCard title="Upload Secure File" subtitle="Drag-and-drop zone with glow border and validation states"><div className="grid h-64 place-items-center rounded-[2rem] border-2 border-dashed border-cyan-300 bg-cyan-50/60 text-center"><div><UploadCloud className="mx-auto text-cyan-600" size={42}/><p className="mt-3 text-lg font-bold">Drop files here or browse</p><p className="text-sm text-slate-500">Upload success, invalid type, oversized error, and integrity failure states included.</p><Button className="mt-4">Upload File</Button></div></div></SectionCard><SectionCard title="Rules Panel" subtitle="File security policy"><div className="space-y-3 text-sm"><p><b>Accepted:</b> PDF, PNG, JPG, DOCX</p><p><b>Blocked:</b> EXE, PHP, JS, BAT, SH</p><p><b>Max size:</b> 10MB</p><p><b>Encryption:</b> AES/Fernet</p><p><b>Integrity:</b> SHA-256</p></div></SectionCard></section>
 <section className="mt-7"><SectionCard title="File Table" subtitle="Encryption and integrity statuses are visible per file."><DataTable columns={['File Name','Type','Size','Uploaded By','Encryption Status','Integrity Status','Upload Date','Actions']} rows={files.map(f=>[f.name,f.type,f.size,f.by,f.encryption,f.integrity,f.date,'Metadata • Download • Verify'])}/></SectionCard></section>
 </>;
}

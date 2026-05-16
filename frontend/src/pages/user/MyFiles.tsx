import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { deleteSecureFile, downloadSecureFile, getSecureFiles, uploadSecureFile, verifySecureFile, type SecureFile } from '../../api/files';
import { useAuth } from '../../auth/AuthContext';

const vaultSteps = [
  'Validate',
  'Encrypt',
  'Hash',
  'Store privately',
  'Verify integrity',
  'Download decrypted file',
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyFiles() {
  const { logoutUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadFiles() {
    setIsLoading(true);
    setError('');
    try {
      setFiles(await getSecureFiles());
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not load files.';
      if (nextError === 'Invalid or expired token.') await logoutUser();
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setError('');
    try {
      const response = await uploadSecureFile(file);
      setMessage(response.message);
      if (inputRef.current) inputRef.current.value = '';
      await loadFiles();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'File upload failed.';
      if (nextError === 'Invalid or expired token.') await logoutUser();
      setError(nextError);
    } finally {
      setIsUploading(false);
    }
  }

  async function verify(file: SecureFile) {
    setVerifyingId(file.id);
    setMessage('');
    setError('');
    try {
      const response = await verifySecureFile(file.id);
      setMessage(`${response.message} Status: ${response.data.integrity_status}.`);
      await loadFiles();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not verify file.';
      if (nextError === 'Invalid or expired token.') await logoutUser();
      setError(nextError);
    } finally {
      setVerifyingId(null);
    }
  }

  async function remove(file: SecureFile) {
    if (!window.confirm(`Delete ${file.original_filename}?`)) return;
    setDeletingId(file.id);
    setMessage('');
    setError('');
    try {
      const response = await deleteSecureFile(file.id);
      setMessage(response.message);
      await loadFiles();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not delete file.';
      if (nextError === 'Invalid or expired token.') await logoutUser();
      setError(nextError);
    } finally {
      setDeletingId(null);
    }
  }

  const rows = useMemo(() => files.map(file => [
    file.original_filename,
    formatSize(file.size_bytes),
    file.content_type,
    new Date(file.created_at).toLocaleString(),
    <Badge tone={file.integrity_status === 'passed' ? 'green' : 'red'}>{file.integrity_status}</Badge>,
    <div key={file.id} className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => void downloadSecureFile(file)}>
        <span className="inline-flex items-center gap-2"><Download size={16}/>Download</span>
      </Button>
      <Button variant="ghost" onClick={() => void verify(file)} disabled={verifyingId === file.id}>
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16}/>{verifyingId === file.id ? 'Verifying...' : 'Verify'}</span>
      </Button>
      <Button variant="danger" onClick={() => void remove(file)} disabled={deletingId === file.id}>
        <span className="inline-flex items-center gap-2"><Trash2 size={16}/>{deletingId === file.id ? 'Deleting...' : 'Delete'}</span>
      </Button>
    </div>,
  ]), [deletingId, files, verifyingId]);

  return <>
    <PageHeader title="My Shared Files" subtitle="Upload, verify, and download your encrypted secure files."/>
    <section className="mb-7 grid gap-3 md:grid-cols-3">
      {vaultSteps.map((step, index) => <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-xs font-bold uppercase text-cyan-600">Step {index + 1}</p>
        <p className="mt-1 text-sm font-bold text-slate-950">{step}</p>
      </div>)}
    </section>
    <SectionCard title="Upload Test" subtitle="Use this to verify valid, invalid, and oversized file behavior on the site.">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <input ref={inputRef} type="file" className="max-w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"/>
        <Button onClick={() => void handleUpload()} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload File'}</Button>
      </div>
      {message && <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</div>}
      {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    </SectionCard>

    <section className="mt-7">
      <SectionCard title="My Secure Files" subtitle="Only files owned by your account are listed here.">
        <div className="mb-5"><Button variant="ghost" onClick={() => void loadFiles()} disabled={isLoading}><RefreshCw size={16} className="mr-2 inline"/>{isLoading ? 'Refreshing...' : 'Refresh'}</Button></div>
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading files...</p> : null}
        {!isLoading && files.length === 0 ? <p className="text-sm font-semibold text-slate-500">No secure files uploaded yet.</p> : null}
        {!isLoading && files.length > 0 ? <DataTable columns={['File Name','Size','MIME Type','Upload Date','Integrity Status','Actions']} rows={rows}/> : null}
      </SectionCard>
    </section>
  </>;
}

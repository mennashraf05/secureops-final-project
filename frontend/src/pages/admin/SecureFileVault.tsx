import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileLock2, RefreshCw, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { DataTable } from '../../components/tables/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { deleteSecureFile, downloadSecureFile, getSecureFiles, uploadSecureFile, verifySecureFile, type SecureFile } from '../../api/files';
import { useAuth } from '../../auth/AuthContext';

const vaultSteps = [
  ['1', 'Validate', 'Extension, MIME type, size, and filename checks run before storage.'],
  ['2', 'Encrypt', 'Accepted files are encrypted with Fernet before writing to disk.'],
  ['3', 'Hash', 'Plaintext and encrypted SHA-256 hashes are calculated and saved.'],
  ['4', 'Store', 'Encrypted bytes are stored in the private Docker file volume.'],
  ['5', 'Verify', 'Integrity can be checked anytime against the encrypted stored file.'],
  ['6', 'Download', 'Authorized users receive decrypted original content only after verification.'],
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function SecureFileVault() {
  const { logoutUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  async function submitUpload() {
    if (!selectedFile) {
      setError('Choose a file first.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setError('');
    try {
      const response = await uploadSecureFile(selectedFile);
      setMessage(response.message);
      setSelectedFile(null);
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
    `#${file.id}`,
    file.original_filename,
    formatSize(file.size_bytes),
    file.content_type,
    formatDate(file.created_at),
    <Badge tone={file.integrity_status === 'passed' ? 'green' : 'red'}>{file.integrity_status}</Badge>,
    <div key={file.id} className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => void downloadSecureFile(file)}>
        <span className="inline-flex items-center gap-2"><Download size={16} />Download</span>
      </Button>
      <Button variant="ghost" onClick={() => void verify(file)} disabled={verifyingId === file.id}>
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16} />{verifyingId === file.id ? 'Verifying...' : 'Verify'}</span>
      </Button>
      <Button variant="danger" onClick={() => void remove(file)} disabled={deletingId === file.id}>
        <span className="inline-flex items-center gap-2"><Trash2 size={16} />{deletingId === file.id ? 'Deleting...' : 'Delete'}</span>
      </Button>
    </div>,
  ]), [deletingId, files, verifyingId]);

  return <>
    <PageHeader title="Secure File Vault" subtitle="Upload, validate, encrypt, verify, and download sensitive inventory documents."/>
    <section className="mb-7 rounded-[2rem] bg-gradient-to-br from-navy to-blue-900 p-7 text-white shadow-glow">
      <FileLock2 className="text-cyan-300"/>
      <h2 className="mt-4 text-3xl font-extrabold">Files are validated, encrypted, hashed, and access-controlled.</h2>
      <div className="mt-6 flex flex-wrap gap-3">{['JWT required','Validate','Encrypt','Hash','Store','Verify','Download'].map((x, i) => <Badge key={x} tone={i >= 5 ? 'green' : 'cyan'}>{x}</Badge>)}</div>
    </section>

    <section className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {vaultSteps.map(([number, title, description]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">{number}</span>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{description}</p>
      </div>)}
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <SectionCard title="Upload Secure File" subtitle="Accepted files are encrypted before being written to disk.">
        <div className="rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/60 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <UploadCloud className="text-cyan-600" size={42}/>
              <p className="mt-3 text-lg font-bold text-slate-950">{selectedFile ? selectedFile.name : 'Choose a file to validate'}</p>
              <p className="mt-1 text-sm text-slate-500">{selectedFile ? formatSize(selectedFile.size) : 'PDF, PNG, JPG, TXT, CSV, DOCX, and XLSX only.'}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input ref={inputRef} type="file" className="max-w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}/>
              <Button onClick={() => void submitUpload()} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload'}</Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Rules Panel" subtitle="File security policy">
        <div className="space-y-3 text-sm text-slate-700">
          <p><b>Accepted:</b> PDF, PNG, JPG, JPEG, TXT, CSV, DOCX, XLSX</p>
          <p><b>Blocked:</b> EXE, PHP, JS, BAT, SH, CMD, PS1, MSI, DLL, JAR, PY, HTML</p>
          <p><b>Max size:</b> 10MB</p>
          <p><b>Storage:</b> encrypted files in private Docker volume</p>
        </div>
      </SectionCard>
    </section>

    <section className="mt-7">
      <SectionCard title="Uploaded Files" subtitle="Admins can view all secure files.">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => void loadFiles()} disabled={isLoading}><RefreshCw size={16} className="mr-2 inline"/>{isLoading ? 'Refreshing...' : 'Refresh'}</Button>
        </div>
        {message && <div className="mb-5 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading ? <p className="text-sm font-semibold text-slate-500">Loading secure files...</p> : null}
        {!isLoading && files.length === 0 ? <p className="text-sm font-semibold text-slate-500">No files uploaded yet.</p> : null}
        {!isLoading && files.length > 0 ? <DataTable columns={['ID','File Name','Size','MIME Type','Upload Date','Integrity Status','Actions']} rows={rows}/> : null}
      </SectionCard>
    </section>
  </>;
}

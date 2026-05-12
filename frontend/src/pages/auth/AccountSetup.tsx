import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';
import { setPassword } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AuthenticatorQrCode } from '../../components/auth/AuthenticatorQrCode';

type SetupStep = 'password' | 'authenticator';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function strongEnough(value: string) {
  return value.length >= 8
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[^A-Za-z]/.test(value);
}

export default function AccountSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyAuthenticatorSetup } = useAuth();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [setupCode, setSetupCode] = useState(searchParams.get('code') ?? '');
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [step, setStep] = useState<SetupStep>('password');
  const [message, setMessage] = useState('Use the setup link from your SecureOps email.');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordChecks = useMemo(() => [
    ['8+ characters', password.length >= 8],
    ['Uppercase and lowercase', /[a-z]/.test(password) && /[A-Z]/.test(password)],
    ['Number or symbol', /[^A-Za-z]/.test(password)],
  ], [password]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!/^\d{6}$/.test(setupCode)) {
      setError('Setup code must be exactly 6 digits.');
      return;
    }
    if (!strongEnough(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await setPassword(email.trim(), setupCode, password);
      setTotpSecret(response.data.totp_secret ?? '');
      setOtpauthUri(response.data.otpauth_uri ?? '');
      setAuthenticatorCode('');
      setStep('authenticator');
      setMessage('Add this SecureOps account to Google Authenticator or a compatible app, then enter the 6-digit code.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAuthenticatorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!/^\d{6}$/.test(authenticatorCode)) {
      setError('Authenticator code must be exactly 6 digits.');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await verifyAuthenticatorSetup(email, authenticatorCode);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify authenticator code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[.9fr_1.1fr]">
      <section className="bg-gradient-to-br from-navy to-violet p-10 text-white">
        <Logo />
        <div className="mt-28 max-w-lg">
          <h1 className="text-5xl font-extrabold">SecureOps account setup</h1>
          <p className="mt-5 text-violet-100">Choose your password, then protect the account with an authenticator app.</p>
        </div>
      </section>

      <section className="grid place-items-center p-6">
        <form onSubmit={step === 'password' ? handlePasswordSubmit : handleAuthenticatorSubmit} className="glass w-full max-w-2xl rounded-[2rem] p-8 shadow-card">
          <h2 className="text-3xl font-extrabold">{step === 'password' ? 'Set password' : 'Set up authenticator'}</h2>

          {message && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
          {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

          {step === 'password' ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-600">Email address</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Mail size={18} />
                  <input className="w-full bg-transparent outline-none" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                </div>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-600">Setup code</span>
                <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="6-digit setup code" value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-600">New password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Lock size={18} />
                  <input className="w-full bg-transparent outline-none" placeholder="New password" type="password" value={password} onChange={(event) => setPasswordValue(event.target.value)} autoComplete="new-password" />
                </div>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-600">Confirm password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Lock size={18} />
                  <input className="w-full bg-transparent outline-none" placeholder="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                </div>
              </label>
              <div className="sm:col-span-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                {passwordChecks.map(([label, passed]) => (
                  <span key={String(label)} className={passed ? 'font-semibold text-emerald-700' : ''}>
                    <ShieldCheck className="mr-1 inline" size={15} />{label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-7 grid gap-4">
              <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-bold">Authenticator secret</p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  {otpauthUri ? <AuthenticatorQrCode uri={otpauthUri} /> : null}
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900">Scan the QR code, or enter this secret manually:</p>
                    <p className="mt-2 break-all font-mono text-xs">{totpSecret}</p>
                  </div>
                </div>
              </div>
              <label>
                <span className="text-sm font-semibold text-slate-600">6-digit authenticator code</span>
                <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none" placeholder="Authenticator code" value={authenticatorCode} onChange={(event) => setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
              </label>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : step === 'password' ? 'Continue' : 'Verify Code'}</Button>
            <Link to="/login"><Button type="button" variant="ghost">Back to login</Button></Link>
          </div>
        </form>
      </section>
    </main>
  );
}

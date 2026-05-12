import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, Network, ShieldCheck } from 'lucide-react';
import { forgotPassword, resetPassword } from '../../api/client';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';

type ResetStep = 'request' | 'reset' | 'complete';

function strongEnough(password: string) {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[^A-Za-z]/.test(password);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotPassword() {
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message);
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(code)) {
      setError('Reset code must be 6 digits.');
      return;
    }
    if (!strongEnough(newPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword(email.trim(), code, newPassword);
      setMessage(response.message);
      setStep('complete');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-ink to-blue-950 p-8 text-white lg:p-14">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="relative">
          <Logo />
          <div className="mt-24 max-w-xl">
            <h1 className="text-5xl font-extrabold leading-tight">Secure password recovery</h1>
            <p className="mt-5 text-lg leading-8 text-cyan-100/80">
              Reset your password with an email code, then sign in normally with mandatory authenticator 2FA.
            </p>
          </div>
          <div className="mt-12 grid gap-4">
            {[
              ['Hashed reset codes', 'Codes expire quickly and cannot be reused'],
              ['No account enumeration', 'Requests return the same safe message'],
              ['2FA preserved', 'Password reset never bypasses authenticator verification'],
            ].map(([title, subtitle]) => (
              <div key={title} className="dark-glass rounded-3xl p-5">
                <div className="flex gap-3">
                  <ShieldCheck className="text-cyan-300" />
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-slate-300">{subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid place-items-center p-6">
        <div className="glass w-full max-w-md rounded-[2rem] p-8 shadow-card">
          <h2 className="text-3xl font-extrabold">Forgot password</h2>
          <p className="mt-2 text-sm text-slate-500">Use the reset code sent to your verified email address.</p>

          {message && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
          {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

          {step === 'request' ? (
            <form onSubmit={submitRequest} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Email</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Mail size={18} />
                  <input className="w-full bg-transparent outline-none" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </label>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Reset Code'}</Button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form onSubmit={submitReset} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Reset code</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <ShieldCheck size={18} />
                  <input className="w-full bg-transparent outline-none" placeholder="6-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">New password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Lock size={18} />
                  <input className="w-full bg-transparent outline-none" type="password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Confirm password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Lock size={18} />
                  <input className="w-full bg-transparent outline-none" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
              </label>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Resetting...' : 'Reset Password'}</Button>
              <Button type="button" variant="ghost" onClick={() => setStep('request')} disabled={isSubmitting}>Send a new code</Button>
            </form>
          ) : null}

          {step === 'complete' ? (
            <div className="mt-7 grid gap-3">
              <Link className="rounded-2xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" to="/login">Back to login</Link>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-700">
            <Network size={16} className="mr-2 inline" /> Password reset does not bypass authenticator 2FA
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            Remembered it? <Link className="font-bold text-blue-600" to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/layout/Logo';
import { useAuth } from '../../auth/AuthContext';
import { resendVerification, verifyEmail } from '../../api/client';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function strongEnough(value: string) {
  return value.length >= 8
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[^A-Za-z]/.test(value);
}

export default function Register() {
  const { registerUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordScore = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /[0-9!@#$%^&*]/.test(password),
  ].filter(Boolean).length;
  const strengthLabel = passwordScore >= 3 ? 'Strong' : passwordScore === 2 ? 'Good' : 'Basic';
  const strengthWidth = passwordScore >= 3 ? 'w-4/5' : passwordScore === 2 ? 'w-2/3' : 'w-1/3';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (isVerificationStep) {
      if (!/^\d{6}$/.test(verificationCode)) {
        setError('Verification code must be exactly 6 digits.');
        return;
      }
      setIsSubmitting(true);
      try {
        await verifyEmail(email, verificationCode);
        setMessage('Email verified successfully. You can now log in.');
        setVerificationCode('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Email verification failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
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
      await registerUser(name.trim(), email.trim(), password);
      setIsVerificationStep(true);
      setMessage('We sent a verification code to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await resendVerification(email);
      setMessage('We sent a verification code to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[.9fr_1.1fr]">
      <section className="bg-gradient-to-br from-navy to-violet p-10 text-white">
        <Logo />
        <div className="mt-28 max-w-lg">
          <h1 className="text-5xl font-extrabold">Create secure access for the inventory network</h1>
          <p className="mt-5 text-violet-100">New accounts are created as normal users. Admin access is managed separately.</p>
        </div>
      </section>

      <section className="grid place-items-center p-6">
        <form onSubmit={handleSubmit} className="glass w-full max-w-2xl rounded-[2rem] p-8 shadow-card">
          <h2 className="text-3xl font-extrabold">Create account</h2>
          {message && (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>
          )}
          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
          )}

          {isVerificationStep ? <div className="mt-7 grid gap-4">
            <label>
              <span className="text-sm font-semibold text-slate-600">6-digit verification code</span>
              <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-blue-100 focus:ring-4" placeholder="Verification code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
            </label>
          </div> : <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold text-slate-600">Full name</span>
              <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-blue-100 focus:ring-4" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-600">Email address</span>
              <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-blue-100 focus:ring-4" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-600">Password</span>
              <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-blue-100 focus:ring-4" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-600">Confirm password</span>
              <input className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-blue-100 focus:ring-4" placeholder="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-slate-600">Role</span>
              <div className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-slate-600">User</div>
            </label>
          </div>}

          {!isVerificationStep ? <div className="mt-6">
            <div className="flex justify-between text-sm font-semibold">
              <span>Password strength</span>
              <span className="text-emerald-600">{strengthLabel}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200"><div className={`${strengthWidth} h-2 rounded-full bg-emerald-500`} /></div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              {['8+ characters', 'Uppercase/lowercase', 'Number or symbol'].map((item) => (
                <span key={item}><ShieldCheck className="mr-1 inline text-emerald-600" size={15} />{item}</span>
              ))}
            </div>
          </div> : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : isVerificationStep ? 'Verify Email' : 'Register'}</Button>
            {isVerificationStep ? <Button type="button" variant="ghost" onClick={() => void handleResendCode()} disabled={isSubmitting}>Resend Code</Button> : null}
            {!isVerificationStep ? <Button type="button" variant="dark"><ShieldCheck className="mr-2 inline" size={16} /> GitHub signup</Button> : null}
            <Link to="/login"><Button type="button" variant="ghost">Back to login</Button></Link>
          </div>
        </form>
      </section>
    </main>
  );
}

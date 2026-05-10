import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, Lock, Mail, Network, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthContext';
import { resendVerification, verifyEmail } from '../../api/client';
import { AuthenticatorQrCode } from '../../components/auth/AuthenticatorQrCode';

type LoginStep = 'password' | 'verify-email' | 'two-factor' | 'two-factor-setup';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser, verifyTwoFactor, verifyAuthenticatorSetup } = useAuth();
  const successMessage = (location.state as { message?: string } | null)?.message;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [step, setStep] = useState<LoginStep>('password');
  const [message, setMessage] = useState(successMessage || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function completeLogin(userRole: 'admin' | 'user') {
    navigate(userRole === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      if (step === 'verify-email') {
        await verifyEmail(email, code);
        setCode('');
        setStep('password');
        setMessage('Email verified successfully. You can now log in.');
        return;
      }

      if (step === 'two-factor') {
        const user = await verifyTwoFactor(email, code);
        setCode('');
        completeLogin(user.role);
        return;
      }

      if (step === 'two-factor-setup') {
        const user = await verifyAuthenticatorSetup(email, code);
        setCode('');
        completeLogin(user.role);
        return;
      }

      const flow = await loginUser(email, password);
      if (flow.email_verification_required) {
        setStep('verify-email');
        setMessage('Email verification required. Enter the code sent to your email, or resend a new code.');
        return;
      }
      if (flow.two_factor_setup_required) {
        setTotpSecret(flow.totp_secret ?? '');
        setOtpauthUri(flow.otpauth_uri ?? '');
        setStep('two-factor-setup');
        setMessage('Add this account to Google Authenticator or a compatible app, then enter the 6-digit code.');
        return;
      }
      if (flow.two_factor_required) {
        setStep('two-factor');
        setMessage('Enter the 6-digit code from your authenticator app.');
        return;
      }

      throw new Error('Login response did not include the next authentication step.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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

  function resetPasswordStep() {
    setStep('password');
    setCode('');
    setTotpSecret('');
    setOtpauthUri('');
    setMessage('');
    setError('');
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-ink to-blue-950 p-8 text-white lg:p-14">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="relative">
          <Logo />
          <div className="mt-24 max-w-xl">
            <h1 className="text-5xl font-extrabold leading-tight">Secure Distributed Inventory Management</h1>
            <p className="mt-5 text-lg leading-8 text-cyan-100/80">
              A premium platform for inventory operations, risk monitoring, audit tracking, and security intelligence.
            </p>
          </div>
          <div className="mt-12 grid gap-4">
            {[
              ['Multi-layer Security', 'JWT, RBAC, authenticator 2FA, audit logs'],
              ['Distributed Architecture', 'Nginx, PostgreSQL, RabbitMQ, worker services'],
              ['Risk Monitoring', 'Security Center, attack simulation, risk scoring'],
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
        <form onSubmit={handleSubmit} className="glass w-full max-w-md rounded-[2rem] p-8 shadow-card">
          <h2 className="text-3xl font-extrabold">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Use your SecureOps account to access the platform.</p>

          {message && (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
          )}

          {step === 'two-factor-setup' && (
            <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-bold">Authenticator setup</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                {otpauthUri ? <AuthenticatorQrCode uri={otpauthUri} /> : null}
                <div className="min-w-0">
                  <p className="font-semibold text-blue-900">Scan the QR code, or enter this secret manually:</p>
                  <p className="mt-2 break-all font-mono text-xs">{totpSecret}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {step !== 'password' ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">
                  {step === 'verify-email' ? 'Verification code' : 'Authenticator code'}
                </span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <ShieldCheck size={18} />
                  <input
                    className="w-full bg-transparent outline-none"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
              </label>
            ) : null}

            {step !== 'two-factor' && step !== 'two-factor-setup' ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Email</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Mail size={18} />
                  <input
                    className="w-full bg-transparent outline-none"
                    name="secureops-login-email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="off"
                  />
                </div>
              </label>
            ) : null}

            {step === 'password' ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Password</span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                  <Lock size={18} />
                  <input
                    className="w-full bg-transparent outline-none"
                    type="password"
                    name="secureops-login-password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="off"
                  />
                  <Eye size={18} />
                </div>
              </label>
            ) : null}
          </div>

          {step === 'password' ? <div className="mt-5 flex items-center justify-between text-sm">
            <label className="flex gap-2"><input type="checkbox" /> Remember me</label>
            <a className="font-semibold text-blue-600">Forgot password?</a>
          </div> : null}

          <div className="mt-7 grid gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : step === 'verify-email' ? 'Verify Email' : step === 'password' ? 'Sign in' : 'Verify Code'}
            </Button>
            {step === 'verify-email' ? <Button type="button" variant="ghost" onClick={() => void handleResendCode()} disabled={isSubmitting}>Resend Code</Button> : null}
            {step !== 'password' ? <Button type="button" variant="ghost" onClick={resetPasswordStep}>Back to sign in</Button> : null}
            {step === 'password' ? <Button type="button" variant="dark">
              <ShieldCheck size={17} className="mr-2 inline" /> Continue with GitHub
            </Button> : null}
          </div>

          <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-700">
            <Network size={16} className="mr-2 inline" /> Protected with JWT authentication and role-based authorization
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            No account? <Link className="font-bold text-blue-600" to="/register">Register</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

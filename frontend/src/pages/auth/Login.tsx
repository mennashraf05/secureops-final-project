import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, Lock, Mail, Network, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/layout/Logo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const successMessage = (location.state as { message?: string } | null)?.message;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await loginUser(email, password);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
            <h1 className="text-5xl font-extrabold leading-tight">Secure Distributed Inventory Management</h1>
            <p className="mt-5 text-lg leading-8 text-cyan-100/80">
              A premium platform for inventory operations, risk monitoring, audit tracking, and security intelligence.
            </p>
          </div>
          <div className="mt-12 grid gap-4">
            {[
              ['Multi-layer Security', 'JWT, RBAC, OAuth, audit logs'],
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

          {successMessage && (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
          )}

          <div className="mt-8 space-y-4">
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
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <label className="flex gap-2"><input type="checkbox" /> Remember me</label>
            <a className="font-semibold text-blue-600">Forgot password?</a>
          </div>

          <div className="mt-7 grid gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Button>
            <Button type="button" variant="dark">
              <ShieldCheck size={17} className="mr-2 inline" /> Continue with GitHub
            </Button>
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

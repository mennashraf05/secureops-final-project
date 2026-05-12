import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    async function finishOAuthLogin() {
      const token = searchParams.get('token');
      const oauthError = searchParams.get('error');
      window.history.replaceState({}, document.title, '/oauth/callback');

      if (!token || oauthError) {
        setError('GitHub login failed.');
        return;
      }

      try {
        const user = await completeOAuthLogin(token);
        navigate(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
      } catch {
        setError('GitHub login failed.');
      }
    }

    void finishOAuthLogin();
  }, [completeOAuthLogin, navigate, searchParams]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="glass w-full max-w-md rounded-[2rem] p-8 text-center shadow-card">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white">
          <ShieldCheck size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">GitHub Login</h1>
        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <p className="mt-4 text-sm font-semibold text-slate-500">Completing secure GitHub sign in...</p>
        )}
      </section>
    </main>
  );
}

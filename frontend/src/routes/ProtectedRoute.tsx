import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../api/client';

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: UserRole;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-card">
          Checking secure session...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/user/dashboard" replace />;
  }

  return children;
}

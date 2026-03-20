import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';

function hasAppAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
    return true;
  }
  if (user.hasTeamMembership) return true;
  return false;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const billingExempt =
    location.pathname.startsWith('/billing') ||
    location.pathname.startsWith('/invitations');

  if (!billingExempt && !hasAppAccess(user)) {
    return <Navigate to="/billing" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

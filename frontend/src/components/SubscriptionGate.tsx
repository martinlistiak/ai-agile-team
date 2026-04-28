import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { withNext } from "@/lib/auth-redirect";

/** Returns true when the user has an active or trialing subscription, or is a team member. */
function hasActiveSubscription(
  user: { subscriptionStatus?: string; hasTeamMembership?: boolean } | null,
): boolean {
  if (!user) return false;
  if (
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing"
  )
    return true;
  if (user.hasTeamMembership) return true;
  return false;
}

/**
 * Wraps app routes that require an active subscription.
 * Redirects to /billing if the user hasn't chosen a plan yet.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!hasActiveSubscription(user)) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={withNext("/billing", next)} replace />;
  }

  return <>{children}</>;
}

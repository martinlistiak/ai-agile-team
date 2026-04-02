import { useAuth } from "@/contexts/AuthContext";
import { BillingPage } from "@/pages/BillingPage";
import { SpaceSidebar } from "@/features/spaces/SpaceSidebar";
import { AgentPanel } from "@/features/agents/AgentPanel";
import { MobileNav } from "@/components/MobileNav";
import { ChatProvider } from "@/contexts/ChatContext";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useMobile } from "@/hooks/useMobile";

/**
 * Renders the billing page inside the full app chrome when the user has an
 * active subscription (normal settings visit), or as a standalone full-screen
 * page when they haven't subscribed yet (onboarding wall).
 */
export function BillingGate() {
  const { user } = useAuth();
  const isMobile = useMobile();

  const isActive =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing" ||
    user?.hasTeamMembership;

  // Users who previously had a subscription (canceled, past_due, etc.)
  // should see the full billing page with their history, not the onboarding wall.
  const hadSubscription =
    user?.subscriptionStatus === "canceled" ||
    user?.subscriptionStatus === "past_due" ||
    user?.hasStripeCustomer;

  if (isActive || hadSubscription) {
    return (
      <ChatProvider>
        <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-950">
          <EmailVerificationBanner />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {!isMobile && <SpaceSidebar />}
            {!isMobile && <AgentPanel />}
            <main
              className={
                isMobile
                  ? "min-w-0 flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
                  : "min-w-0 flex-1 overflow-y-auto"
              }
            >
              <BillingPage />
            </main>
          </div>
          {isMobile && <MobileNav />}
        </div>
      </ChatProvider>
    );
  }

  // No subscription — render billing page standalone (no sidebar, no nav)
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <BillingPage onboarding />
    </div>
  );
}

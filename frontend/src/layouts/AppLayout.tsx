import { Outlet } from "react-router-dom";
import { SpaceSidebar } from "@/features/spaces/SpaceSidebar";
import { AgentPanel } from "@/features/agents/AgentPanel";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { MobileNav } from "@/components/MobileNav";
import { ChatProvider } from "@/contexts/ChatContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useMobile } from "@/hooks/useMobile";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout() {
  const isMobile = useMobile();
  const { isImpersonating } = useAuth();

  return (
    <ChatProvider>
      <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-950">
        <ImpersonationBanner />
        <EmailVerificationBanner />
        <div
          className="flex min-h-0 flex-1 overflow-hidden"
          style={{ marginTop: isImpersonating ? "40px" : undefined }}
        >
          {/* Desktop: show sidebars. Mobile: hide them, use bottom nav instead */}
          {!isMobile && <SpaceSidebar />}
          {!isMobile && <AgentPanel />}
          {!isMobile && <ChatDrawer />}
          <main
            className={
              isMobile
                ? "min-w-0 flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
                : "min-w-0 flex-1 overflow-y-auto"
            }
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        {isMobile && <MobileNav />}
      </div>
    </ChatProvider>
  );
}

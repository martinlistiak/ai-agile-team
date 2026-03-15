import { Outlet } from "react-router-dom";
import { SpaceSidebar } from "@/features/spaces/SpaceSidebar";
import { AgentPanel } from "@/features/agents/AgentPanel";
import { ChatProvider } from "@/contexts/ChatContext";

export function AppLayout() {
  return (
    <ChatProvider>
      <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-950">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <SpaceSidebar />
          <AgentPanel />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}

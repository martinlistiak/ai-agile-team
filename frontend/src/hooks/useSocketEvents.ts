import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useToast } from "@/components/Toast";

/**
 * Subscribes to Socket.IO events for a given space.
 * Auto-invalidates React Query caches when real-time updates arrive.
 */
export function useSocketEvents(spaceId: string | null) {
  const queryClient = useQueryClient();
  const joinedRef = useRef<string | null>(null);
  const { error: showError } = useToast();

  useEffect(() => {
    if (!spaceId) return;

    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    // Join the space room
    socket.emit("join_space", { space_id: spaceId });
    joinedRef.current = spaceId;

    const handleTicketCreated = () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    };

    const handleTicketUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    };

    const handleAgentStatus = () => {
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
    };

    const handleChatMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["chatMessages", spaceId] });
    };

    const handlePipelineEvent = (payload: {
      action?: string;
      agentType?: string;
      error?: string;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
      if (payload?.action === "failed") {
        const agent = payload.agentType ?? "Agent";
        showError(
          `${agent.charAt(0).toUpperCase() + agent.slice(1)} agent failed${payload.error ? `: ${payload.error}` : ""}`,
        );
      }
    };

    const handleSuggestedRule = () => {
      queryClient.invalidateQueries({ queryKey: ["suggestedRules", spaceId] });
    };

    const handlePipelineCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
    };

    const handleExecutionAction = (payload: { agentId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      if (payload?.agentId) {
        queryClient.invalidateQueries({
          queryKey: ["executions", payload.agentId],
        });
      }
    };

    const handleFileChange = () => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    };

    const handleBrowserScreenshot = () => {
      // No cache invalidation needed — components subscribe directly
    };

    const handleBrowserSessionEnd = () => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    };

    const handleGithubPush = () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    };

    socket.on("ticket_created", handleTicketCreated);
    socket.on("ticket_updated", handleTicketUpdated);
    socket.on("agent_status", handleAgentStatus);
    socket.on("chat_message", handleChatMessage);
    socket.on("pipeline_event", handlePipelineEvent);
    socket.on("suggested_rule", handleSuggestedRule);
    socket.on("pipeline_completed", handlePipelineCompleted);
    socket.on("execution_action", handleExecutionAction);
    socket.on("file_change", handleFileChange);
    socket.on("browser_screenshot", handleBrowserScreenshot);
    socket.on("browser_session_end", handleBrowserSessionEnd);
    socket.on("github_push", handleGithubPush);

    return () => {
      if (joinedRef.current) {
        socket.emit("leave_space", { space_id: joinedRef.current });
        joinedRef.current = null;
      }
      socket.off("ticket_created", handleTicketCreated);
      socket.off("ticket_updated", handleTicketUpdated);
      socket.off("agent_status", handleAgentStatus);
      socket.off("chat_message", handleChatMessage);
      socket.off("pipeline_event", handlePipelineEvent);
      socket.off("suggested_rule", handleSuggestedRule);
      socket.off("pipeline_completed", handlePipelineCompleted);
      socket.off("execution_action", handleExecutionAction);
      socket.off("file_change", handleFileChange);
      socket.off("browser_screenshot", handleBrowserScreenshot);
      socket.off("browser_session_end", handleBrowserSessionEnd);
      socket.off("github_push", handleGithubPush);
    };
  }, [spaceId, queryClient, showError]);
}

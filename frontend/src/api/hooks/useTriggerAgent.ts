import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import { getApiErrorPayload, isTokenQuotaError } from "@/lib/api-errors";
import { useTokenTopUp } from "@/contexts/TokenTopUpContext";

interface TriggerAgentResponse {
  queued: boolean;
  agentType?: string;
  error?: string;
  message?: string;
}

export function useTriggerAgent() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const { showTopUp } = useTokenTopUp();
  return useMutation<
    TriggerAgentResponse,
    Error,
    { ticketId: string; spaceId: string }
  >({
    mutationFn: async ({ ticketId }) => {
      const { data } = await api.post<TriggerAgentResponse>(
        `/tickets/${ticketId}/trigger-agent`,
      );
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["agents", variables.spaceId],
      });
      const agent = data.agentType ?? "Agent";
      success(
        `${agent.charAt(0).toUpperCase() + agent.slice(1)} agent triggered`,
      );
    },
    onError: (err: unknown) => {
      if (isTokenQuotaError(err)) {
        showTopUp(getApiErrorPayload(err).message);
        return;
      }
      showError(getApiErrorPayload(err).message || "Failed to trigger agent");
    },
  });
}

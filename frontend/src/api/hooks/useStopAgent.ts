import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";

export function useStopAgent() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  return useMutation<
    { stopped: boolean },
    Error,
    { agentId: string; spaceId: string }
  >({
    mutationFn: async ({ agentId }) => {
      const { data } = await api.post(`/agents/${agentId}/stop`);
      return data;
    },
    onSuccess: (data, variables) => {
      if (data.stopped) {
        success("Agent execution stopped");
      }
      queryClient.invalidateQueries({
        queryKey: ["agents", variables.spaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["executions", variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err) => {
      showError(err.message || "Failed to stop agent");
    },
  });
}

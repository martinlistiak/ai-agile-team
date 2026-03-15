import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";

export function usePipelineConfig(spaceId: string | null) {
  return useQuery<Record<string, boolean>>({
    queryKey: ["pipeline", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/pipeline`);
      return data;
    },
    enabled: !!spaceId,
  });
}

export function useUpdatePipelineConfig() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      spaceId: string;
      config: Record<string, boolean>;
    }) => {
      const { data } = await api.patch(
        `/spaces/${payload.spaceId}/pipeline`,
        payload.config,
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline", variables.spaceId],
      });
      success("Pipeline config updated");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to update pipeline config");
    },
  });
}

export function useAdvanceTicket() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; spaceId: string }) => {
      const { data } = await api.post(`/tickets/${payload.ticketId}/advance`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["agents", variables.spaceId],
      });
      success("Ticket advanced to next stage");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to advance ticket");
    },
  });
}

export function useRunPipeline() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; spaceId: string }) => {
      const { data } = await api.post(
        `/tickets/${payload.ticketId}/run-pipeline`,
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["agents", variables.spaceId],
      });
      success("Pipeline started");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to run pipeline");
    },
  });
}

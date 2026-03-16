import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { Agent, Execution } from "@/types";

export function useAgents(spaceId: string | null) {
  return useQuery<Agent[]>({
    queryKey: ["agents", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/agents`);
      return data;
    },
    enabled: !!spaceId,
  });
}

interface ExecutionsResponse {
  data: Execution[];
  total: number;
  page: number;
}

export function useExecutions(agentId: string | null, page = 1, limit = 20) {
  return useQuery<ExecutionsResponse>({
    queryKey: ["executions", agentId, page, limit],
    queryFn: async () => {
      const { data } = await api.get(
        `/agents/${agentId}/executions?page=${page}&limit=${limit}`,
      );
      return data;
    },
    enabled: !!agentId,
  });
}

export function useCreateCustomAgent(spaceId: string | null) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      systemPrompt?: string;
    }) => {
      if (!spaceId) throw new Error("Space ID is required");
      const { data } = await api.post(
        `/spaces/${spaceId}/agents/custom`,
        payload,
      );
      return data as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
    },
    onError: () => {
      showError("Failed to create custom agent");
    },
  });
}

export function useUpdateCustomAgent(spaceId: string | null) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      description?: string;
      systemPrompt?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.patch(`/agents/${id}/custom`, body);
      return data as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
    },
    onError: () => {
      showError("Failed to update custom agent");
    },
  });
}

export function useDeleteCustomAgent(spaceId: string | null) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data } = await api.delete(`/agents/${agentId}/custom`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", spaceId] });
    },
    onError: () => {
      showError("Failed to delete custom agent");
    },
  });
}

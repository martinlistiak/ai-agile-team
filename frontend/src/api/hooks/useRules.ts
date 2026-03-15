import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";

export interface Rule {
  id: string;
  spaceId: string;
  agentId: string | null;
  scope: "space" | "agent" | "cross-team";
  content: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedRule {
  id: string;
  spaceId: string;
  agentId: string | null;
  executionId: string | null;
  content: string;
  reasoning: string;
  status: "pending" | "accepted" | "rejected";
  suggestedScope: string;
  createdAt: string;
}

export function useRules(spaceId: string | null) {
  return useQuery<Rule[]>({
    queryKey: ["rules", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/rules`);
      return data;
    },
    enabled: !!spaceId,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      spaceId: string;
      content: string;
      scope: string;
      agentId?: string;
    }) => {
      const { spaceId, ...body } = payload;
      const { data } = await api.post(`/spaces/${spaceId}/rules`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rules", variables.spaceId] });
      success("Rule created");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to create rule");
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      spaceId: string;
      content?: string;
      isActive?: boolean;
    }) => {
      const { id, spaceId, ...body } = payload;
      const { data } = await api.patch(`/rules/${id}`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rules", variables.spaceId] });
      success("Rule updated");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to update rule");
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { id: string; spaceId: string }) => {
      await api.delete(`/rules/${payload.id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rules", variables.spaceId] });
      success("Rule deleted");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to delete rule");
    },
  });
}

export function useSuggestedRules(spaceId: string | null) {
  return useQuery<SuggestedRule[]>({
    queryKey: ["suggestedRules", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/suggested-rules`);
      return data;
    },
    enabled: !!spaceId,
    refetchInterval: 30000,
  });
}

export function useAcceptSuggestedRule() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { id: string; spaceId: string }) => {
      const { data } = await api.post(`/suggested-rules/${payload.id}/accept`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["suggestedRules", variables.spaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["rules", variables.spaceId] });
      success("Rule accepted");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to accept rule");
    },
  });
}

export function useRejectSuggestedRule() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { id: string; spaceId: string }) => {
      const { data } = await api.post(`/suggested-rules/${payload.id}/reject`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["suggestedRules", variables.spaceId],
      });
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to reject rule");
    },
  });
}

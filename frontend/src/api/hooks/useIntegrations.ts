import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";

interface ApiKeyEntry {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function useApiKeys() {
  return useQuery<ApiKeyEntry[]>({
    queryKey: ["integrations", "api-keys"],
    queryFn: async () => {
      const { data } = await api.get("/integrations/api-keys");
      return data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post("/integrations/api-keys", { name });
      return data as { key: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "api-keys"] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/integrations/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "api-keys"] });
    },
  });
}

export function useDisconnectProvider() {
  return useMutation({
    mutationFn: async (provider: "github" | "gitlab") => {
      await api.post(`/integrations/${provider}/disconnect`);
    },
    onSuccess: () => {
      window.location.reload();
    },
  });
}

export function useReviewerTokenStatus() {
  return useQuery<{ configured: boolean }>({
    queryKey: ["integrations", "reviewer-token"],
    queryFn: async () => {
      const { data } = await api.get(
        "/integrations/github/reviewer-token/status",
      );
      return data;
    },
  });
}

export function useSaveReviewerToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      await api.post("/integrations/github/reviewer-token", { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["integrations", "reviewer-token"],
      });
    },
  });
}

export function useClearReviewerToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete("/integrations/github/reviewer-token");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["integrations", "reviewer-token"],
      });
    },
  });
}

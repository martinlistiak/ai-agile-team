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

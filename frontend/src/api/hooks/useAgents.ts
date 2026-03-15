import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
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

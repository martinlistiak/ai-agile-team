import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";

// ── Types ──

interface SsoConfig {
  id: string;
  provider: "saml" | "oidc";
  entityId: string;
  ssoUrl: string;
  certificate: string;
  metadataUrl: string | null;
  defaultRole: string | null;
  enforceSSO: boolean;
  enabled: boolean;
}

interface Training {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  documentCount: number;
  errorMessage: string | null;
  createdAt: string;
}

interface SlaStatus {
  config: {
    uptimeTarget: number;
    responseTimeMsTarget: number;
    resolutionTimeHoursTarget: number;
    currentUptime: number;
    avgResponseTimeMs: number;
    totalIncidents: number;
    resolvedIncidents: number;
  };
  compliance: {
    uptimeCompliant: boolean;
    responseTimeCompliant: boolean;
    resolutionTimeCompliant: boolean;
    overallCompliant: boolean;
  };
}

interface AnalyticsDashboard {
  overview: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTimeMs: number;
    activeAgents: number;
    totalTickets: number;
    ticketsCompleted: number;
  };
  executionsByDay: {
    date: string;
    count: number;
    success: number;
    failed: number;
  }[];
  agentPerformance: {
    agentType: string;
    executions: number;
    successRate: number;
    avgTimeMs: number;
  }[];
  ticketVelocity: { date: string; created: number; completed: number }[];
  topSpaces: { spaceId: string; spaceName: string; executions: number }[];
}

// ── Hooks ──

export function useEnterpriseTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await api.get("/teams");
      return data as { id: string; name: string }[];
    },
  });
}

export function useAnalyticsDashboard(teamId: string | null, days: number) {
  return useQuery<AnalyticsDashboard>({
    queryKey: ["enterprise", "analytics", teamId, days],
    queryFn: async () => {
      const { data } = await api.get(
        `/enterprise/analytics/${teamId}/dashboard?days=${days}`,
      );
      return data;
    },
    enabled: !!teamId,
  });
}

export function useSsoConfig(teamId: string) {
  return useQuery<SsoConfig | null>({
    queryKey: ["enterprise", "sso", teamId],
    queryFn: async () => {
      const { data } = await api.get(`/enterprise/sso/${teamId}`);
      return data;
    },
  });
}

export function useSaveSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      teamId: string;
      form: Record<string, unknown>;
    }) => {
      const { data } = await api.post(
        `/enterprise/sso/${payload.teamId}/configure`,
        payload.form,
      );
      return data as SsoConfig;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["enterprise", "sso", variables.teamId], data);
    },
  });
}

export function useToggleSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { teamId: string; enabled: boolean }) => {
      const { data } = await api.patch(
        `/enterprise/sso/${payload.teamId}/toggle`,
        { enabled: payload.enabled },
      );
      return data as SsoConfig;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["enterprise", "sso", variables.teamId], data);
    },
  });
}

export function useDeleteSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`/enterprise/sso/${teamId}`);
    },
    onSuccess: (_, teamId) => {
      queryClient.setQueryData(["enterprise", "sso", teamId], null);
    },
  });
}

export function useTrainingAgents() {
  return useQuery<{ id: string; name: string; agentType: string }[]>({
    queryKey: ["enterprise", "training-agents"],
    queryFn: async () => {
      const { data: spaces } = await api.get("/spaces");
      const allAgents: any[] = [];
      for (const s of spaces.slice(0, 5)) {
        const { data } = await api.get(`/spaces/${s.id}/agents`);
        allAgents.push(...data);
      }
      return allAgents;
    },
  });
}

export function useTrainings(agentId: string | null) {
  return useQuery<Training[]>({
    queryKey: ["enterprise", "trainings", agentId],
    queryFn: async () => {
      const { data } = await api.get(`/enterprise/training/${agentId}`);
      return data;
    },
    enabled: !!agentId,
  });
}

export function useCreateTraining() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      agentId: string;
      name: string;
      documents: { fileName: string; content: string; mimeType: string }[];
    }) => {
      await api.post(`/enterprise/training/${payload.agentId}`, {
        name: payload.name,
        documents: payload.documents,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["enterprise", "trainings", variables.agentId],
      });
    },
  });
}

export function useApplyTraining() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { trainingId: string; agentId: string }) => {
      await api.post(`/enterprise/training/${payload.trainingId}/apply`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["enterprise", "trainings", variables.agentId],
      });
    },
  });
}

export function useDeleteTraining() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { trainingId: string; agentId: string }) => {
      await api.delete(`/enterprise/training/${payload.trainingId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["enterprise", "trainings", variables.agentId],
      });
    },
  });
}

export function useSlaStatus(teamId: string) {
  return useQuery<SlaStatus | null>({
    queryKey: ["enterprise", "sla", teamId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/enterprise/sla/${teamId}`);
        return data;
      } catch {
        return null;
      }
    },
  });
}

export function useConfigureSla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      teamId: string;
      form: Record<string, number>;
    }) => {
      await api.post(
        `/enterprise/sla/${payload.teamId}/configure`,
        payload.form,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["enterprise", "sla", variables.teamId],
      });
    },
  });
}

export type { SsoConfig, Training, SlaStatus, AnalyticsDashboard };

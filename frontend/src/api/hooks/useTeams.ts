import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { Team, TeamDetail } from "@/types";

/** Turn raw HTTP errors into friendly messages */
function friendlyError(err: any, fallback: string): string {
  const msg: string | undefined = err.response?.data?.message;
  if (!msg || /^Cannot (GET|POST|PUT|PATCH|DELETE) \//.test(msg))
    return fallback;
  return msg;
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await api.get("/teams");
      return data;
    },
  });
}

export function useTeamDetail(teamId: string | null) {
  return useQuery<TeamDetail>({
    queryKey: ["teams", teamId],
    queryFn: async () => {
      const { data } = await api.get(`/teams/${teamId}`);
      return data;
    },
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post("/teams", { name });
      return data as Team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      showError(
        friendlyError(
          err,
          "Failed to create team. Please check your connection and try again.",
        ),
      );
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { teamId: string; name: string }) => {
      const { data } = await api.patch(`/teams/${payload.teamId}`, {
        name: payload.name,
      });
      return data as Team;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
      success("Team name updated");
    },
    onError: (err: any) => {
      showError(friendlyError(err, "Failed to update team name"));
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      teamId: string;
      email: string;
      role: "member" | "admin";
    }) => {
      await api.post(`/teams/${payload.teamId}/invitations`, {
        email: payload.email,
        role: payload.role,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
    onError: (err: any) => {
      showError(friendlyError(err, "Failed to send invitation"));
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { teamId: string; invitationId: string }) => {
      await api.delete(
        `/teams/${payload.teamId}/invitations/${payload.invitationId}`,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { teamId: string; memberId: string }) => {
      await api.delete(`/teams/${payload.teamId}/members/${payload.memberId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
    onError: (err: any) => {
      showError(friendlyError(err, "Failed to remove member"));
    },
  });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      teamId: string;
      memberId: string;
      role: "admin" | "member";
    }) => {
      await api.patch(
        `/teams/${payload.teamId}/members/${payload.memberId}/role`,
        {
          role: payload.role,
        },
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
    onError: (err: any) => {
      showError(friendlyError(err, "Failed to update role"));
    },
  });
}

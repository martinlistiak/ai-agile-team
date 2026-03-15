import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { GithubRepository, GitlabRepository, Space } from "@/types";

export function useSpaces() {
  return useQuery<Space[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const { data } = await api.get("/spaces");
      return data;
    },
  });
}

export function useSpace(id: string | null) {
  return useQuery<Space>({
    queryKey: ["spaces", id],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      githubRepoUrl?: string;
      gitlabRepoUrl?: string;
    }) => {
      const { data } = await api.post("/spaces", payload);
      return data as Space;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      success("Space created");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to create space");
    },
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & Record<string, unknown>) => {
      const { data } = await api.patch(`/spaces/${id}`, payload);
      return data as Space;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      success("Space updated");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to update space");
    },
  });
}

export function useReorderSpaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await api.post("/spaces/reorder", { orderedIds });
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["spaces"] });
      const previous = queryClient.getQueryData<Space[]>(["spaces"]);
      if (previous) {
        const reordered = orderedIds
          .map((id) => previous.find((s) => s.id === id))
          .filter(Boolean) as Space[];
        queryClient.setQueryData(["spaces"], reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["spaces"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/spaces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      success("Space deleted");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to delete space");
    },
  });
}

export function useGithubRepositories(enabled = true) {
  return useQuery<GithubRepository[]>({
    queryKey: ["github", "repositories"],
    queryFn: async () => {
      const { data } = await api.get("/auth/github/repos");
      return data;
    },
    enabled,
  });
}

export function useGitlabRepositories(enabled = true) {
  return useQuery<GitlabRepository[]>({
    queryKey: ["gitlab", "repositories"],
    queryFn: async () => {
      const { data } = await api.get("/auth/gitlab/repos");
      return data;
    },
    enabled,
  });
}

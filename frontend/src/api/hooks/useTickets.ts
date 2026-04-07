import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { Ticket, TicketStatus } from "@/types";

export function useTickets(spaceId: string | null) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/tickets`);
      return data;
    },
    enabled: !!spaceId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      spaceId: string;
      title: string;
      description?: string;
      priority?: string;
      status?: string;
    }) => {
      const { data } = await api.post(
        `/spaces/${payload.spaceId}/tickets`,
        payload,
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      success("Ticket created");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to create ticket");
    },
  });
}

export function useMoveTicket() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      ticketId: string;
      status: TicketStatus;
      spaceId: string;
    }) => {
      const { data } = await api.patch(`/tickets/${payload.ticketId}/move`, {
        status: payload.status,
      });
      return data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      const previous = queryClient.getQueryData<Ticket[]>([
        "tickets",
        variables.spaceId,
      ]);
      queryClient.setQueryData<Ticket[]>(
        ["tickets", variables.spaceId],
        (old) =>
          old?.map((t) =>
            t.id === variables.ticketId
              ? { ...t, status: variables.status }
              : t,
          ),
      );
      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["tickets", variables.spaceId],
          context.previous,
        );
      }
      showError("Failed to move ticket");
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
    },
  });
}

export function useReorderTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      spaceId: string;
      status: string;
      ticketIds: string[];
    }) => {
      const { data } = await api.patch(
        `/spaces/${payload.spaceId}/tickets/reorder`,
        { status: payload.status, ticketIds: payload.ticketIds },
      );
      return data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      const previous = queryClient.getQueryData<Ticket[]>([
        "tickets",
        variables.spaceId,
      ]);
      queryClient.setQueryData<Ticket[]>(
        ["tickets", variables.spaceId],
        (old) => {
          if (!old) return old;
          const orderMap = new Map(variables.ticketIds.map((id, i) => [id, i]));
          return old.map((t) => {
            const newOrder = orderMap.get(t.id);
            return newOrder !== undefined ? { ...t, order: newOrder } : t;
          });
        },
      );
      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["tickets", variables.spaceId],
          context.previous,
        );
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      ticketId: string;
      spaceId: string;
      title?: string;
      description?: string;
      priority?: string;
      assigneeAgentId?: string | null;
      assigneeUserId?: string | null;
      startWorking?: boolean;
    }) => {
      const { ticketId, spaceId, ...body } = payload;
      const { data } = await api.patch(`/tickets/${ticketId}`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      success("Ticket updated");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to update ticket");
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { ticketId: string; spaceId: string }) => {
      await api.delete(`/tickets/${payload.ticketId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      success("Ticket deleted");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to delete ticket");
    },
  });
}

export function useBulkDeleteTickets() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: { spaceId: string; ticketIds: string[] }) => {
      const { data } = await api.post(
        `/spaces/${payload.spaceId}/tickets/bulk-delete`,
        { ticketIds: payload.ticketIds },
      );
      return data as { deleted: number };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      success(`${data.deleted} ticket${data.deleted === 1 ? "" : "s"} deleted`);
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to delete tickets");
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      ticketId: string;
      spaceId: string;
      content: string;
    }) => {
      const { data } = await api.post(`/tickets/${payload.ticketId}/comments`, {
        content: payload.content,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to add comment");
    },
  });
}

export function useMergePr() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async ({ ticketId }: { ticketId: string; spaceId: string }) => {
      const { data } = await api.post(`/tickets/${ticketId}/merge-pr`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tickets", variables.spaceId],
      });
      success("PR merged successfully");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to merge PR");
    },
  });
}

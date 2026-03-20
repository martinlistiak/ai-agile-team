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
    onSuccess: (_, variables) => {
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
    onSuccess: (_, variables) => {
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import { getApiErrorPayload, isAgentRunQuotaError } from "@/lib/api-errors";
import type { ChatMessage } from "@/types";

export type AgentType = "pm" | "developer" | "tester" | "reviewer";
export type ChatAgentType = AgentType | string;

export function useChatMessages(spaceId: string | null, agentType?: ChatAgentType) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chatMessages", spaceId, agentType],
    queryFn: async () => {
      const params = agentType ? `?agentType=${agentType}` : "";
      const { data } = await api.get(`/chat/${spaceId}/messages${params}`);
      return data;
    },
    enabled: !!spaceId,
  });
}

export function useSendChatMessage(spaceId: string | null) {
  const queryClient = useQueryClient();
  const { error: showError, agentRunLimit } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      message: string;
      files: File[];
      agentType?: ChatAgentType;
      ticketId?: string;
    }) => {
      if (!spaceId) {
        throw new Error(
          "A space must be selected before sending a chat message",
        );
      }

      const formData = new FormData();
      formData.append("message", payload.message);
      formData.append("agentType", payload.agentType || "pm");
      if (payload.ticketId) {
        formData.append("ticketId", payload.ticketId);
      }
      payload.files.forEach((file) => formData.append("files", file));

      const { data } = await api.post(`/chat/${spaceId}/send`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data as {
        response: string;
        createdTickets?: Array<{ ticketId: string; title: string }>;
        assistantMessage: ChatMessage;
      };
    },
    onMutate: async (payload) => {
      if (!spaceId) return;

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["chatMessages", spaceId] });

      const previous = queryClient.getQueryData<ChatMessage[]>([
        "chatMessages",
        spaceId,
        payload.agentType,
      ]);

      // Build optimistic user message
      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: payload.message,
        timestamp: new Date().toISOString(),
        agentType: payload.agentType,
        attachments: payload.files.map((file, i) => ({
          id: `optimistic-att-${i}`,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          isImage: file.type.startsWith("image/"),
          url: URL.createObjectURL(file),
        })),
      };

      queryClient.setQueryData<ChatMessage[]>(
        ["chatMessages", spaceId, payload.agentType],
        (old = []) => [...old, optimisticMessage],
      );

      return { previous };
    },
    onError: (err, payload, context) => {
      // Roll back to previous messages on error
      if (context?.previous && spaceId) {
        queryClient.setQueryData(
          ["chatMessages", spaceId, payload.agentType],
          context.previous,
        );
      }
      if (isAgentRunQuotaError(err)) {
        agentRunLimit(getApiErrorPayload(err).message);
        return;
      }
      showError(
        getApiErrorPayload(err).message || "Failed to send message",
      );
    },
    onSettled: (_data, _err, payload) => {
      queryClient.invalidateQueries({
        queryKey: ["chatMessages", spaceId, payload.agentType],
      });
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    },
  });
}

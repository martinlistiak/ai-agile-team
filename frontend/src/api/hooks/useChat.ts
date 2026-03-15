import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { ChatMessage } from "@/types";

export type AgentType = "pm" | "developer" | "tester";

export function useChatMessages(spaceId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chatMessages", spaceId],
    queryFn: async () => {
      const { data } = await api.get(`/chat/${spaceId}/messages`);
      return data;
    },
    enabled: !!spaceId,
  });
}

export function useSendChatMessage(spaceId: string | null) {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      message: string;
      images: File[];
      agentType?: AgentType;
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
      payload.images.forEach((image) => formData.append("images", image));

      const { data } = await api.post(`/chat/${spaceId}/send`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onMutate: async (payload) => {
      if (!spaceId) return;

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["chatMessages", spaceId] });

      const previous = queryClient.getQueryData<ChatMessage[]>([
        "chatMessages",
        spaceId,
      ]);

      // Build optimistic user message
      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: payload.message,
        timestamp: new Date().toISOString(),
        attachments: payload.images.map((file, i) => ({
          id: `optimistic-att-${i}`,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          isImage: file.type.startsWith("image/"),
          url: URL.createObjectURL(file),
        })),
      };

      queryClient.setQueryData<ChatMessage[]>(
        ["chatMessages", spaceId],
        (old = []) => [...old, optimisticMessage],
      );

      return { previous };
    },
    onError: (_err, _payload, context) => {
      // Roll back to previous messages on error
      if (context?.previous && spaceId) {
        queryClient.setQueryData(["chatMessages", spaceId], context.previous);
      }
      showError("Failed to send message");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chatMessages", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    },
  });
}

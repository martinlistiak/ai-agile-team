import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import { getApiErrorPayload } from "@/lib/api-errors";
import type { NotificationPreference } from "@/types";

export function useNotificationPreferences() {
  return useQuery<NotificationPreference>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data } = await api.get<NotificationPreference>(
        "/notifications/preferences",
      );
      return data;
    },
  });
}

export function usePatchNotificationPreferences() {
  const queryClient = useQueryClient();
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (updates: Partial<NotificationPreference>) => {
      const { data } = await api.patch<NotificationPreference>(
        "/notifications/preferences",
        updates,
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
    },
    onError: (err) => {
      showError(getApiErrorPayload(err).message);
    },
  });
}

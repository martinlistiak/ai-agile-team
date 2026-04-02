import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";
import type { User } from "@/types";

export function useImpersonate() {
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/auth/impersonate/${userId}`);
      return data as {
        accessToken: string;
        user: User;
        isImpersonating: boolean;
      };
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Failed to impersonate user";
      showError(msg);
    },
  });
}

export function useStopImpersonation() {
  const { error: showError } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auth/stop-impersonation");
      return data as { accessToken: string; user: User };
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Failed to stop impersonation";
      showError(msg);
    },
  });
}

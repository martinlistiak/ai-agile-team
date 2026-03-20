import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import type { InvitationInfo } from "@/types";

export function useInvitationInfo(token: string | undefined) {
  return useQuery<InvitationInfo>({
    queryKey: ["invitation", token],
    queryFn: async () => {
      const { data } = await api.get(`/invitations/${token}`);
      return data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (token: string) => {
      await api.post(`/invitations/${token}/accept`);
    },
  });
}

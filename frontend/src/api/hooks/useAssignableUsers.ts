import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import type { AssignableUser } from "@/types";

export function useAssignableUsers(spaceId: string | null) {
  return useQuery<AssignableUser[]>({
    queryKey: ["assignable-users", spaceId],
    queryFn: async () => {
      const { data } = await api.get<AssignableUser[]>(
        `/spaces/${spaceId}/assignable-users`,
      );
      return data;
    },
    enabled: !!spaceId,
  });
}

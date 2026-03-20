---
inclusion: fileMatch
fileMatchPattern: "frontend/src/**/*.{ts,tsx}"
---

# TanStack Query — project conventions

All frontend API calls must go through TanStack Query hooks. Never use raw `api.get/post/…` calls, `fetch`, or `useEffect`-based data fetching directly in components.

## Setup

- `QueryClientProvider` is in `frontend/src/App.tsx` with 30s `staleTime` and 1 retry.
- The axios instance lives at `frontend/src/api/client.ts` (imported as `api`).
- All hooks live in `frontend/src/api/hooks/use*.ts`.

## Writing a query hook

```ts
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

export function useThings(parentId: string | null) {
  return useQuery<Thing[]>({
    queryKey: ["things", parentId],
    queryFn: async () => {
      const { data } = await api.get(`/parents/${parentId}/things`);
      return data;
    },
    enabled: !!parentId,
  });
}
```

- Always type the generic on `useQuery<T>`.
- Use `enabled` when the key depends on a nullable param.
- Keep `queryKey` arrays hierarchical: `["domain", id, "sub-resource"]`.

## Writing a mutation hook

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";

export function useCreateThing() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: CreateThingDto) => {
      const { data } = await api.post("/things", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things"] });
      success("Thing created");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to create thing");
    },
  });
}
```

- Invalidate related queries in `onSuccess`.
- Use `useToast()` for user-facing success/error feedback in mutations.
- For optimistic updates, use `onMutate` / `onError` / `onSettled` (see `useReorderSpaces` for the pattern).
- For mutations that redirect (checkout, portal), skip toast and handle the redirect in the component after `mutateAsync`.

## Rules

1. One hook per API operation — no multi-endpoint hooks.
2. Components consume hooks, never call `api.*` directly.
3. Use `isPending` from the mutation for loading states — don't add separate `useState<boolean>` for loading.
4. Use `queryClient.invalidateQueries` over manual refetches.
5. Use `queryClient.setQueryData` when the server response already contains the updated data (avoids an extra round-trip).
6. Group related hooks in a single file per domain (e.g. `useTeams.ts` has `useTeams`, `useTeamDetail`, `useCreateTeam`, etc.).

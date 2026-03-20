import { useQuery } from "@tanstack/react-query";

type ComponentState = "up" | "down" | "unknown";

export type HealthSnapshot = {
  overall: "operational" | "degraded" | "unreachable";
  api: ComponentState;
  db: ComponentState;
  redis: ComponentState;
  checkedAt: number;
};

function parseHealthPayload(
  json: unknown,
): Pick<HealthSnapshot, "db" | "redis" | "overall"> | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const db = o.db === "up" || o.db === "down" ? o.db : null;
  const redis = o.redis === "up" || o.redis === "down" ? o.redis : null;
  if (!db || !redis) return null;
  const status = o.status === "ok" || o.status === "error" ? o.status : null;
  if (!status) return null;
  return { db, redis, overall: status === "ok" ? "operational" : "degraded" };
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const checkedAt = Date.now();
  try {
    const res = await fetch("/api/health", { credentials: "omit" });
    const json: unknown = await res.json().catch(() => null);
    const parsed = parseHealthPayload(json);
    if (parsed) return { ...parsed, api: "up", checkedAt };
    if (res.ok)
      return {
        overall: "operational",
        api: "up",
        db: "unknown",
        redis: "unknown",
        checkedAt,
      };
    return {
      overall: "degraded",
      api: "up",
      db: "unknown",
      redis: "unknown",
      checkedAt,
    };
  } catch {
    return {
      overall: "unreachable",
      api: "down",
      db: "unknown",
      redis: "unknown",
      checkedAt,
    };
  }
}

export function useHealth() {
  return useQuery<HealthSnapshot>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  });
}

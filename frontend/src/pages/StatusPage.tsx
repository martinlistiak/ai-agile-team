import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiRefreshCw,
  FiServer,
  FiWifiOff,
  FiZap,
} from "react-icons/fi";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicNav } from "@/components/PublicNav";
import { useHealth, type HealthSnapshot } from "@/api/hooks/useHealth";

type ComponentState = "up" | "down" | "unknown";

function StatusDot({ state }: { state: ComponentState }) {
  if (state === "up") {
    return (
      <span
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
        title="Operational"
      />
    );
  }
  if (state === "down") {
    return (
      <span
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
        title="Unavailable"
      />
    );
  }
  return (
    <span
      className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
      title="Unknown"
    />
  );
}

const statusPageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&display=swap');

  .status-page-root {
    --hue-brand: 239;
    --surface: oklch(0.985 0.004 var(--hue-brand));
    --surface-raised: oklch(1 0 0);
    --text-primary: oklch(0.18 0.02 var(--hue-brand));
    --text-secondary: oklch(0.45 0.01 var(--hue-brand));
    --text-tertiary: oklch(0.6 0.008 var(--hue-brand));
    --accent: oklch(0.55 0.22 var(--hue-brand));
    --border: oklch(0.88 0.008 var(--hue-brand));
    --border-light: oklch(0.93 0.005 var(--hue-brand));

    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--text-primary);
    background: var(--surface);
    min-height: 100vh;
  }

  .status-page-root * { box-sizing: border-box; }
  .font-display { font-family: 'Instrument Serif', Georgia, serif; }

  .nav-blur {
    backdrop-filter: blur(12px) saturate(1.4);
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    background: oklch(0.985 0.004 239 / 0.85);
  }
`;

export function StatusPage() {
  const queryClient = useQueryClient();
  const { data: snapshot, isLoading: loading, isFetching } = useHealth();

  useEffect(() => {
    document.title = "System status — Runa";
  }, []);

  const refreshing = loading || isFetching;

  const summary = snapshot
    ? snapshot.overall === "operational"
      ? {
          label: "All systems operational",
          hint: "Core services are healthy and responding normally.",
          tone: "ok" as const,
        }
      : snapshot.overall === "degraded"
        ? {
            label: "Degraded performance",
            hint: "Some components may be impaired. We are notified automatically.",
            tone: "warn" as const,
          }
        : {
            label: "Unable to verify status",
            hint: "We could not complete a health check. Your network or our services may be affected.",
            tone: "bad" as const,
          }
    : {
        label: "Checking status…",
        hint: "Contacting Runa services.",
        tone: "pending" as const,
      };

  const rows: {
    name: string;
    detail: string;
    state: ComponentState;
    icon: typeof FiServer;
  }[] = snapshot
    ? [
        {
          name: "Core application",
          detail: "Sign-in, workspaces, and main product features",
          state: snapshot.api,
          icon: FiServer,
        },
        {
          name: "Data services",
          detail: "Persistent storage for your workspaces",
          state: snapshot.db,
          icon: FiActivity,
        },
        {
          name: "Supporting services",
          detail: "Live updates, sessions, and background processing",
          state: snapshot.redis,
          icon: FiZap,
        },
      ]
    : [];

  return (
    <div className="status-page-root">
      <style>{statusPageStyles}</style>
      <PublicNav />

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-[720px] mx-auto">
          <p
            className="text-[13px] font-medium tracking-wide uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            Trust & reliability
          </p>
          <h1
            className="font-display tracking-[-0.02em] mb-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            System status
          </h1>
          <p
            className="text-[14px] leading-relaxed mb-10 max-w-xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Live overview of how Runa is running from your current network.
            Status is checked from your browser and refreshed about every minute.
          </p>

          <div
            className="rounded-2xl border p-6 mb-8"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-raised)",
              boxShadow: "0 1px 2px oklch(0.2 0.02 239 / 0.04)",
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background:
                      summary.tone === "ok"
                        ? "oklch(0.92 0.08 145)"
                        : summary.tone === "warn"
                          ? "oklch(0.94 0.08 85)"
                          : summary.tone === "bad"
                            ? "oklch(0.93 0.06 25)"
                            : "oklch(0.93 0.02 239)",
                  }}
                >
                  {summary.tone === "ok" ? (
                    <FiCheck className="h-6 w-6 text-emerald-700" aria-hidden />
                  ) : summary.tone === "pending" ? (
                    <FiRefreshCw
                      className={`h-6 w-6 text-indigo-600 ${refreshing ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                  ) : summary.tone === "warn" ? (
                    <FiAlertTriangle
                      className="h-6 w-6 text-amber-800"
                      aria-hidden
                    />
                  ) : (
                    <FiWifiOff className="h-6 w-6 text-red-700" aria-hidden />
                  )}
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {summary.label}
                  </h2>
                  <p
                    className="text-[13px] mt-1 leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {summary.hint}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["health"] })
                }
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 self-start rounded-lg border px-3 py-2 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                }}
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
            {snapshot && (
              <p
                className="text-[12px] mt-5 pt-5 border-t"
                style={{
                  color: "var(--text-tertiary)",
                  borderColor: "var(--border-light)",
                }}
              >
                Last checked{" "}
                {new Date(snapshot.checkedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>

          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Components
          </h3>
          <ul className="space-y-3 mb-12">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <li
                  key={row.name}
                  className="flex items-center gap-4 rounded-xl border px-4 py-4"
                  style={{
                    borderColor: "var(--border-light)",
                    background: "var(--surface-raised)",
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "oklch(0.96 0.02 239)" }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: "var(--accent)" }}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-[14px] font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.name}
                      </p>
                      <StatusDot state={row.state} />
                    </div>
                    <p
                      className="text-[12px] mt-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {row.detail}
                    </p>
                  </div>
                  <span
                    className="hidden sm:inline text-[11px] font-medium uppercase tracking-wide shrink-0"
                    style={{
                      color:
                        row.state === "up"
                          ? "oklch(0.45 0.14 145)"
                          : row.state === "down"
                            ? "oklch(0.5 0.2 25)"
                            : "var(--text-tertiary)",
                    }}
                  >
                    {row.state === "up"
                      ? "Operational"
                      : row.state === "down"
                        ? "Down"
                        : "Unknown"}
                  </span>
                </li>
              );
            })}
            {!snapshot && (
              <li
                className="rounded-xl border px-4 py-6 text-center text-[13px]"
                style={{
                  borderColor: "var(--border-light)",
                  color: "var(--text-tertiary)",
                }}
              >
                Loading component status…
              </li>
            )}
          </ul>

          <div
            className="rounded-2xl border p-6"
            style={{ borderColor: "var(--border-light)" }}
          >
            <h3
              className="text-sm font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Incidents
            </h3>
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              There are no active incidents reported for Runa. For questions or
              to report an issue, contact{" "}
              <a
                href="mailto:privacy@runa-app.com"
                className="font-medium underline underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                privacy@runa-app.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

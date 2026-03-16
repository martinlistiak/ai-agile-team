import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "@/components/Drawer";
import { useExecutions } from "@/api/hooks/useAgents";
import { useTickets } from "@/api/hooks/useTickets";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/cn";
import { useChatContext } from "@/contexts/ChatContext";
import { useStopAgent } from "@/api/hooks/useStopAgent";
import type { Agent, Execution, Ticket } from "@/types";
import { BrowserStreamViewer } from "./BrowserStreamViewer";

/* ── helpers ── */

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.slice(0, 7);
}

const STATUS_DOT: Record<string, string> = {
  running: "bg-amber-500",
  completed: "bg-emerald-600 dark:bg-emerald-500",
  failed: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

const AGENT_NAMES: Record<string, string> = {
  pm: "Product Manager",
  developer: "Developer",
  reviewer: "Reviewer",
  tester: "Tester",
};

/* ── file change types ── */

interface FileChangeSummary {
  filePath: string;
  additions: number;
  deletions: number;
}

function extractFileChanges(
  actionLog: Record<string, unknown>[],
): FileChangeSummary[] {
  const fileMap = new Map<string, FileChangeSummary>();

  for (const action of actionLog) {
    const tool = action.tool as string | undefined;
    const input = action.input as Record<string, unknown> | undefined;
    const output = action.output as Record<string, unknown> | undefined;

    // Detect file writes / edits from action logs
    if (
      tool &&
      (tool.includes("write") ||
        tool.includes("edit") ||
        tool.includes("replace") ||
        tool.includes("create") ||
        tool.includes("patch"))
    ) {
      const filePath =
        (input?.path as string) ??
        (input?.filePath as string) ??
        (input?.file as string) ??
        null;
      if (filePath) {
        const existing = fileMap.get(filePath);
        // Estimate lines from content length if available
        const content =
          (input?.content as string) ?? (input?.text as string) ?? "";
        const lines = content ? content.split("\n").length : 0;
        if (existing) {
          existing.additions += lines;
        } else {
          fileMap.set(filePath, { filePath, additions: lines, deletions: 0 });
        }
      }
    }

    // Also check output for diff info
    if (output?.diff && typeof output.diff === "object") {
      const diff = output.diff as {
        additions?: number[];
        deletions?: number[];
      };
      const filePath = (output.filePath as string) ?? (input?.path as string);
      if (filePath) {
        const existing = fileMap.get(filePath);
        const adds = diff.additions?.length ?? 0;
        const dels = diff.deletions?.length ?? 0;
        if (existing) {
          existing.additions += adds;
          existing.deletions += dels;
        } else {
          fileMap.set(filePath, { filePath, additions: adds, deletions: dels });
        }
      }
    }
  }

  return Array.from(fileMap.values());
}

/* ── file diff row ── */

function FileDiffRow({ file }: { file: FileChangeSummary }) {
  const fileName = file.filePath.split("/").pop() ?? file.filePath;
  const dirPath = file.filePath.includes("/")
    ? file.filePath.slice(0, file.filePath.lastIndexOf("/"))
    : "";

  return (
    <div className="group flex items-center gap-3 py-1.5 px-2 -mx-2 rounded transition-colors hover:bg-stone-100 dark:hover:bg-stone-800/50">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <svg
          className="w-3.5 h-3.5 shrink-0 text-stone-400 dark:text-stone-500"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M3.75 1.5a1.25 1.25 0 00-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V5.372a1.25 1.25 0 00-.366-.884l-2.872-2.872a1.25 1.25 0 00-.884-.366H3.75z" />
        </svg>
        <span className="text-[13px] text-stone-800 dark:text-stone-200 truncate">
          {fileName}
        </span>
        {dirPath && (
          <span className="text-[11px] text-stone-400 dark:text-stone-500 truncate hidden group-hover:inline">
            {dirPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 tabular-nums text-[12px]">
        {file.additions > 0 && (
          <span className="text-emerald-700 dark:text-emerald-400">
            +{file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-600 dark:text-red-400">
            −{file.deletions}
          </span>
        )}
        {file.additions === 0 && file.deletions === 0 && (
          <span className="text-stone-400">modified</span>
        )}
      </div>
    </div>
  );
}

/* ── execution card with ticket context ── */

function HistoryEntry({
  execution,
  ticket,
}: {
  execution: Execution;
  ticket: Ticket | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const actions = Array.isArray(execution.actionLog) ? execution.actionLog : [];
  const fileChanges = extractFileChanges(actions);
  const totalAdds = fileChanges.reduce((s, f) => s + f.additions, 0);
  const totalDels = fileChanges.reduce((s, f) => s + f.deletions, 0);

  return (
    <div
      className={cn(
        "border-b border-gray-200 dark:border-gray-800 last:border-b-0",
        "transition-colors",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-stone-100/60 dark:hover:bg-stone-800/30 transition-colors"
      >
        {/* status dot */}
        <span
          className={cn(
            "mt-1.5 h-2 w-2 rounded-full shrink-0",
            STATUS_DOT[execution.status] ?? STATUS_DOT.running,
            execution.status === "running" && "animate-pulse",
          )}
        />

        <div className="min-w-0 flex-1">
          {/* ticket title or fallback */}
          <p className="text-[13px] font-medium text-stone-800 dark:text-stone-200 leading-snug truncate">
            {ticket?.title ?? `Execution ${shortId(execution.id)}`}
          </p>

          {/* meta row */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              {relativeTime(execution.startTime)}
            </span>
            <span className="text-[11px] text-stone-300 dark:text-stone-600">
              ·
            </span>
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              {STATUS_LABEL[execution.status] ?? execution.status}
            </span>
            {fileChanges.length > 0 && (
              <>
                <span className="text-[11px] text-stone-300 dark:text-stone-600">
                  ·
                </span>
                <span className="text-[11px] text-stone-400 dark:text-stone-500">
                  {fileChanges.length} file{fileChanges.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {(totalAdds > 0 || totalDels > 0) && (
              <span className="text-[11px] tabular-nums">
                {totalAdds > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{totalAdds}
                  </span>
                )}
                {totalAdds > 0 && totalDels > 0 && (
                  <span className="text-stone-300 dark:text-stone-600"> </span>
                )}
                {totalDels > 0 && (
                  <span className="text-red-500 dark:text-red-400">
                    −{totalDels}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* expand chevron */}
        <svg
          className={cn(
            "mt-1 w-4 h-4 shrink-0 text-stone-300 dark:text-stone-600 transition-transform duration-200",
            expanded && "rotate-90",
          )}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" />
        </svg>
      </button>

      {/* expanded: file changes */}
      {expanded && (
        <div
          className="px-4 pb-3 animate-fade-in"
          style={{ paddingLeft: "2.25rem" }}
        >
          {fileChanges.length > 0 ? (
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
                Changed files
              </p>
              {fileChanges.map((file) => (
                <FileDiffRow key={file.filePath} file={file} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-stone-400 dark:text-stone-500 italic">
              No file changes recorded
            </p>
          )}

          {/* action summary */}
          {actions.length > 0 && (
            <div className="mt-3 pt-2 border-t border-stone-100 dark:border-stone-800">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1">
                Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  actions.reduce((map, a) => {
                    const tool = (a.tool as string) ?? "unknown";
                    map.set(tool, (map.get(tool) ?? 0) + 1);
                    return map;
                  }, new Map<string, number>()),
                ).map(([tool, count]) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-sm bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 text-[11px] text-stone-500 dark:text-stone-400"
                  >
                    {tool}
                    {count > 1 && (
                      <span className="text-stone-400 dark:text-stone-500">
                        ×{count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main inspector ── */

interface AgentInspectorProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentInspector({ agent, onClose }: AgentInspectorProps) {
  const { spaceId } = useParams();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useExecutions(agent.id, page, 20);
  const { data: tickets = [] } = useTickets(spaceId ?? null);
  const queryClient = useQueryClient();
  const { openChat } = useChatContext();
  const stopAgent = useStopAgent();

  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  const handleChatClick = useCallback(() => {
    openChat(agent.agentType);
    onClose();
  }, [openChat, agent.agentType, onClose]);

  const handleStop = useCallback(() => {
    if (!spaceId) return;
    stopAgent.mutate({ agentId: agent.id, spaceId });
  }, [stopAgent, agent.id, spaceId]);

  // Refresh executions on live events
  useEffect(() => {
    const socket = getSocket();
    const handleExecutionAction = (action: { agentId: string }) => {
      if (action.agentId === agent.id) {
        queryClient.invalidateQueries({ queryKey: ["executions", agent.id] });
      }
    };
    socket.on("execution_action", handleExecutionAction);
    return () => {
      socket.off("execution_action", handleExecutionAction);
    };
  }, [agent.id, queryClient]);

  useEffect(() => {
    setPage(1);
  }, [agent.id]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const executions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const isLive = agent.status === "active";

  return createPortal(
    <Drawer
      onClose={handleClose}
      className="w-full max-w-md animate-slide-in-right"
      aria-label={`${AGENT_NAMES[agent.agentType] ?? agent.agentType} Inspector`}
    >
      {/* ── header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 dark:border-stone-800 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
            {AGENT_NAMES[agent.agentType] ?? agent.agentType}
          </h2>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopAgent.isPending}
              className="rounded-md bg-red-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {stopAgent.isPending ? "Stopping…" : "Stop"}
            </button>
          )}
          <button
            type="button"
            onClick={handleChatClick}
            className="rounded-md bg-stone-800 dark:bg-stone-200 px-3 py-1 text-[12px] font-medium text-stone-50 dark:text-stone-800 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors cursor-pointer"
          >
            Chat
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300 cursor-pointer transition-colors"
            aria-label="Close inspector"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Browser session for tester */}
        {agent.agentType === "tester" && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Browser Session
            </p>
            <BrowserStreamViewer agentId={agent.id} isLive={isLive} />
          </div>
        )}

        {/* History */}
        <div className="mt-2">
          <div className="px-4 py-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
              History
            </p>
            {total > 0 && (
              <span className="text-[11px] tabular-nums text-stone-400 dark:text-stone-500">
                {total} run{total !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 dark:border-stone-700 border-t-stone-500 dark:border-t-stone-400" />
            </div>
          ) : executions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[13px] text-stone-400 dark:text-stone-500">
                No runs yet
              </p>
              <p className="text-[12px] text-stone-350 dark:text-stone-600 mt-1">
                Executions will appear here when this agent processes tickets.
              </p>
            </div>
          ) : (
            <div>
              {executions.map((execution) => (
                <HistoryEntry
                  key={execution.id}
                  execution={execution}
                  ticket={ticketMap.get(execution.ticketId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── pagination ── */}
      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-stone-200 dark:border-stone-800 px-4 py-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded px-2 py-1 text-[12px] text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[11px] tabular-nums text-stone-400 dark:text-stone-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded px-2 py-1 text-[12px] text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </Drawer>,
    document.body,
  );
}

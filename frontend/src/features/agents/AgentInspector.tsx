import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useExecutions } from "@/api/hooks/useAgents";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/cn";
import { useChatContext } from "@/contexts/ChatContext";
import type { Agent, Execution } from "@/types";
import { MonacoCodeViewer } from "./MonacoCodeViewer";
import { BrowserStreamViewer } from "./BrowserStreamViewer";

interface ExecutionAction {
  executionId: string;
  agentId: string;
  tool: string;
  inputSummary: string;
  timestamp: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  running: {
    label: "Running",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE[status] ?? STATUS_BADGE.running;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function summarizeInput(input: unknown): string {
  if (typeof input === "string") return input.slice(0, 120);
  if (input && typeof input === "object") {
    const str = JSON.stringify(input);
    return str.length > 120 ? str.slice(0, 117) + "..." : str;
  }
  return String(input ?? "");
}

function ActionRow({
  action,
}: {
  action: {
    tool?: string;
    input?: unknown;
    output?: unknown;
    timestamp?: string;
    status?: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
      >
        <span className="shrink-0 text-[10px] text-gray-400 tabular-nums w-16">
          {action.timestamp ? formatTime(action.timestamp) : "—"}
        </span>
        <span className="shrink-0 font-mono text-xs text-indigo-600 dark:text-indigo-400 w-32 truncate">
          {action.tool ?? "unknown"}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-400">
          {summarizeInput(action.input)}
        </span>
        {action.status && <StatusBadge status={action.status} />}
        <span
          className={cn(
            "shrink-0 text-gray-400 transition-transform text-xs",
            expanded && "rotate-90",
          )}
        >
          ▶
        </span>
      </button>
      {expanded && (
        <div className="bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-xs space-y-2 overflow-auto max-h-64">
          <div>
            <p className="font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Input
            </p>
            <pre className="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300 font-mono">
              {JSON.stringify(action.input, null, 2) ?? "—"}
            </pre>
          </div>
          {action.output !== undefined && (
            <div>
              <p className="font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Output
              </p>
              <pre className="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300 font-mono">
                {JSON.stringify(action.output, null, 2) ?? "—"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExecutionCard({ execution }: { execution: Execution }) {
  const [open, setOpen] = useState(false);
  const actions = Array.isArray(execution.actionLog) ? execution.actionLog : [];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
      >
        <span className="shrink-0 text-xs text-gray-500 tabular-nums">
          {formatTime(execution.startTime)}
        </span>
        <StatusBadge status={execution.status} />
        <span className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-400">
          {actions.length} action{actions.length !== 1 ? "s" : ""}
        </span>
        <span
          className={cn(
            "shrink-0 text-gray-400 transition-transform text-xs",
            open && "rotate-90",
          )}
        >
          ▶
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-200 dark:border-gray-800">
          {actions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">
              No actions recorded
            </p>
          ) : (
            actions.map((action, i) => <ActionRow key={i} action={action} />)
          )}
        </div>
      )}
    </div>
  );
}

function LiveActionRow({ action }: { action: ExecutionAction }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm animate-fade-in">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
      <span className="shrink-0 text-[10px] text-gray-400 tabular-nums w-16">
        {formatTime(action.timestamp)}
      </span>
      <span className="shrink-0 font-mono text-xs text-indigo-600 dark:text-indigo-400 w-32 truncate">
        {action.tool}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-400">
        {action.inputSummary}
      </span>
    </div>
  );
}

const AGENT_NAMES: Record<string, string> = {
  pm: "Product Manager",
  developer: "Developer",
  tester: "Tester",
};

interface AgentInspectorProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentInspector({ agent, onClose }: AgentInspectorProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useExecutions(agent.id, page, 20);
  const [liveActions, setLiveActions] = useState<ExecutionAction[]>([]);
  const queryClient = useQueryClient();
  const { openChat } = useChatContext();

  const handleChatClick = useCallback(() => {
    openChat(agent.agentType);
    onClose();
  }, [openChat, agent.agentType, onClose]);

  // Subscribe to live execution_action events
  useEffect(() => {
    const socket = getSocket();

    const handleExecutionAction = (action: ExecutionAction) => {
      if (action.agentId === agent.id) {
        setLiveActions((prev) => [action, ...prev].slice(0, 50));
        // Invalidate executions cache so historical data refreshes
        queryClient.invalidateQueries({ queryKey: ["executions", agent.id] });
      }
    };

    socket.on("execution_action", handleExecutionAction);
    return () => {
      socket.off("execution_action", handleExecutionAction);
    };
  }, [agent.id, queryClient]);

  // Clear live actions when agent changes
  useEffect(() => {
    setLiveActions([]);
    setPage(1);
  }, [agent.id]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  const executions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const isLive = agent.status === "active";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={handleClose}
      />
      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {AGENT_NAMES[agent.agentType] ?? agent.agentType} Inspector
            </h2>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleChatClick}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
            >
              Chat with {AGENT_NAMES[agent.agentType] ?? agent.agentType}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Live streaming section */}
          {isLive && liveActions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Live Actions
              </h3>
              <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 divide-y divide-green-100 dark:divide-green-800/30">
                {liveActions.map((action, i) => (
                  <LiveActionRow
                    key={`${action.timestamp}-${i}`}
                    action={action}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Live Code Viewer */}
          {agent.agentType === "developer" && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Code Changes
              </h3>
              <MonacoCodeViewer agentId={agent.id} isLive={isLive} />
            </div>
          )}

          {/* Browser Session Viewer */}
          {agent.agentType === "tester" && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Browser Session
              </h3>
              <BrowserStreamViewer agentId={agent.id} isLive={isLive} />
            </div>
          )}

          {/* Execution history */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Execution History
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
              </div>
            ) : executions.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No executions yet
              </p>
            ) : (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <ExecutionCard key={execution.id} execution={execution} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

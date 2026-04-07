import { useState, useEffect, useRef, useCallback } from "react";
import {
  FiX,
  FiSend,
  FiExternalLink,
  FiCheck,
  FiTrash2,
  FiPlay,
} from "react-icons/fi";
import {
  useUpdateTicket,
  useAddComment,
  useCreateTicket,
} from "@/api/hooks/useTickets";
import { useTriggerAgent } from "@/api/hooks/useTriggerAgent";
import { useAgents } from "@/api/hooks/useAgents";
import { useAssignableUsers } from "@/api/hooks/useAssignableUsers";
import { RichTextEditor } from "@/components/RichTextEditor";
import { MentionInput } from "@/components/MentionInput";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { PipelinePrompt } from "@/components/PipelinePrompt";
import RotatingBorder from "@/components/RotatingBorder";
import { getAvatarSrc } from "@/lib/avatars";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  overlayBackdropClass,
  overlayBorderClass,
  overlaySurfaceClass,
} from "@/components/overlaySurface";
import { cn } from "@/lib/cn";
import type { Ticket, AgentType, Priority, TicketStatus } from "@/types";

/** Default column label per agent type (for "Start working?" confirmation). */
const AGENT_DEFAULT_COLUMN: Record<string, string> = {
  pm: "Backlog",
  developer: "Development",
  reviewer: "Review",
  tester: "Testing",
  custom: "Development",
};
const AGENT_LABEL: Record<string, string> = {
  pm: "PM",
  developer: "Developer",
  reviewer: "Reviewer",
  tester: "Tester",
  custom: "Custom",
};

/* ── status config ─────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  backlog: { dot: "bg-stone-400", label: "Backlog" },
  development: { dot: "bg-violet-500", label: "Development" },
  review: { dot: "bg-amber-500", label: "Code Review" },
  testing: { dot: "bg-orange-500", label: "Testing" },
  staged: { dot: "bg-indigo-500", label: "Staged" },
  done: { dot: "bg-emerald-500", label: "Done" },
};

const PRIORITY_LABEL: Record<Priority, { text: string; color: string }> = {
  critical: { text: "Critical", color: "text-red-600 dark:text-red-400" },
  high: { text: "High", color: "text-amber-600 dark:text-amber-400" },
  medium: { text: "Medium", color: "text-stone-500 dark:text-stone-400" },
  low: { text: "Low", color: "text-stone-400 dark:text-stone-500" },
};

/* ── component ─────────────────────────────────────────────── */

interface TicketDetailPanelProps {
  /** Pass a ticket for edit mode, or omit/null for create mode. */
  ticket?: Ticket | null;
  spaceId: string;
  onClose: () => void;
  onDelete?: (ticketId: string) => void;
  /** Called after a new ticket is successfully created. */
  onCreate?: () => void;
  /** Default status when creating a new ticket (e.g. from a column). */
  defaultStatus?: TicketStatus;
}

export function TicketDetailPanel({
  ticket,
  spaceId,
  onClose,
  onDelete,
  onCreate,
  defaultStatus,
}: TicketDetailPanelProps) {
  const isCreateMode = !ticket;
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [commentContent, setCommentContent] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [commentKey, setCommentKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [createPriority, setCreatePriority] = useState<Priority>("medium");
  const panelRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef(ticket?.description ?? "");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateTicket = useUpdateTicket();
  const createTicket = useCreateTicket();
  const addComment = useAddComment();
  const triggerAgent = useTriggerAgent();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [pendingAgentStart, setPendingAgentStart] = useState<{
    agentId: string;
    agentType: AgentType;
  } | null>(null);
  const { data: agents = [] } = useAgents(spaceId);
  const { data: assignableUsers = [] } = useAssignableUsers(spaceId);
  const assignedAgent = ticket?.assigneeAgentId
    ? (agents.find((a) => a.id === ticket.assigneeAgentId) ?? null)
    : null;
  const assignedUser = ticket?.assigneeUserId
    ? (assignableUsers.find((u) => u.id === ticket.assigneeUserId) ?? null)
    : null;

  // sync state when ticket changes
  useEffect(() => {
    if (!ticket) return;
    setTitle(ticket.title);
    setDescription(ticket.description);
    descriptionRef.current = ticket.description;
  }, [ticket, ticket?.id, ticket?.title, ticket?.description]);

  // debounced autosave for description (edit mode only)
  const autosaveDescription = useCallback(
    (markdown: string) => {
      descriptionRef.current = markdown;
      setDescription(markdown);
      if (isCreateMode) return;
      setSaveStatus("saving");
      clearTimeout(saveTimerRef.current);
      clearTimeout(savedTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateTicket.mutate(
          {
            ticketId: ticket!.id,
            spaceId,
            description: descriptionRef.current,
          },
          {
            onSuccess: () => {
              setSaveStatus("saved");
              savedTimerRef.current = setTimeout(
                () => setSaveStatus("idle"),
                2000,
              );
            },
            onError: () => {
              setSaveStatus("idle");
            },
          },
        );
      }, 800);
    },
    [ticket, spaceId, updateTicket, isCreateMode],
  );

  // flush pending timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(savedTimerRef.current);
    };
  }, []);

  // entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVisible(false);
        setTimeout(onClose, 280);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSave = () => {
    if (isCreateMode) return;
    updateTicket.mutate({ ticketId: ticket!.id, spaceId, title, description });
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createTicket.mutate(
      {
        spaceId,
        title: title.trim(),
        description: description || undefined,
        priority: createPriority,
        status: defaultStatus,
      },
      {
        onSuccess: () => {
          handleClose();
          onCreate?.();
        },
      },
    );
  };

  const handleSubmitComment = () => {
    if (isCreateMode) return;
    const trimmed = commentContent.trim();
    if (!trimmed) return;
    addComment.mutate(
      { ticketId: ticket!.id, spaceId, content: trimmed },
      {
        onSuccess: () => {
          setCommentContent("");
          setCommentKey((k) => k + 1);
        },
      },
    );
  };

  const handleTriggerAgent = () => {
    if (isCreateMode || triggerAgent.isPending) return;
    triggerAgent.mutate({ ticketId: ticket!.id, spaceId });
  };

  const handleDelete = () => {
    if (isCreateMode) return;
    setShowDeleteConfirm(false);
    handleClose();
    onDelete?.(ticket!.id);
  };

  const PLAY_ENABLED: Set<TicketStatus> = new Set([
    "development",
    "review",
    "testing",
  ]);
  const canTrigger =
    !isCreateMode && PLAY_ENABLED.has(ticket!.status as TicketStatus);
  const isAgentRunning =
    !isCreateMode &&
    !!ticket!.assigneeAgentId &&
    agents.some(
      (a) => a.id === ticket!.assigneeAgentId && a.status === "active",
    );

  const currentStatus = ticket?.status ?? defaultStatus ?? "backlog";
  const currentPriority = ticket?.priority ?? createPriority;
  const status = STATUS_STYLE[currentStatus] ?? STATUS_STYLE.backlog;
  const priority = PRIORITY_LABEL[currentPriority] ?? PRIORITY_LABEL.medium;
  const createdDate = ticket ? new Date(ticket.createdAt) : null;
  const updatedDate = ticket ? new Date(ticket.updatedAt) : null;

  return (
    <>
      {/* backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-colors duration-280",
          isVisible ? overlayBackdropClass : "bg-transparent",
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isCreateMode ? "New ticket" : `Ticket: ${ticket!.title}`}
        className={cn(
          "ticket-detail-panel",
          overlaySurfaceClass,
          overlayBorderClass,
          "fixed right-0 top-0 z-50 h-full w-full max-w-full md:max-w-[560px] flex flex-col border-l",
          "shadow-[-8px_0_32px_rgba(28,25,23,0.08)]",
          "dark:shadow-[-8px_0_32px_rgba(0,0,0,0.3)]",
          "transition-transform duration-280 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isVisible ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* ── header ── */}
        <div className="px-4 pt-4 pb-0 md:px-7 md:pt-6 space-y-3">
          {/* top bar: status · priority | actions */}
          <div className="flex items-center gap-2.5">
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", status.dot)}
              aria-hidden="true"
            />
            <span className="text-xs font-medium tracking-wide uppercase text-stone-500 dark:text-stone-400">
              {status.label}
            </span>
            <span className="text-stone-300 dark:text-stone-600 text-xs select-none">
              ·
            </span>
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu((v) => !v)}
                className={cn(
                  "cursor-pointer text-xs font-medium tracking-wide uppercase rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors",
                  "hover:bg-stone-200/60 dark:hover:bg-stone-800",
                  priority.color,
                )}
                title="Change priority"
              >
                {priority.text}
              </button>
              {showPriorityMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPriorityMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg py-1 shadow-lg min-w-[120px]">
                    {(["low", "medium", "high", "critical"] as Priority[]).map(
                      (p) => {
                        const cfg = PRIORITY_LABEL[p];
                        const isActive = currentPriority === p;
                        return (
                          <button
                            key={p}
                            onClick={() => {
                              setShowPriorityMenu(false);
                              if (!isActive) {
                                if (isCreateMode) {
                                  setCreatePriority(p);
                                } else {
                                  updateTicket.mutate({
                                    ticketId: ticket!.id,
                                    spaceId,
                                    priority: p,
                                  });
                                }
                              }
                            }}
                            className={cn(
                              "cursor-pointer w-full text-left px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
                              isActive
                                ? "bg-stone-100 dark:bg-stone-700"
                                : "hover:bg-stone-50 dark:hover:bg-stone-700/50",
                              cfg.color,
                            )}
                          >
                            {cfg.text}
                          </button>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </div>

            {/* right side: assignee + actions */}
            <div className="ml-auto flex items-center gap-1.5">
              {/* assignee (edit mode only) — no label, just the face */}
              {!isCreateMode && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAssignMenu((v) => !v)}
                    className={cn(
                      "cursor-pointer flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs min-w-0 transition-colors",
                      "hover:bg-stone-100 dark:hover:bg-stone-800",
                    )}
                    title={
                      assignedAgent
                        ? `Assigned to ${assignedAgent.agentType}`
                        : assignedUser
                          ? `Assigned to ${assignedUser.name}`
                          : "Unassigned"
                    }
                  >
                    {assignedAgent ? (
                      <>
                        <img
                          src={getAvatarSrc(assignedAgent.agentType)}
                          alt=""
                          className="h-5 w-5 rounded-full shrink-0 pixelated"
                        />
                        <span className="capitalize truncate text-stone-600 dark:text-stone-300 font-medium">
                          {assignedAgent.agentType}
                        </span>
                      </>
                    ) : assignedUser ? (
                      <>
                        {assignedUser.avatarUrl ? (
                          <img
                            src={assignedUser.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-full shrink-0 object-cover"
                          />
                        ) : (
                          <div
                            className="h-5 w-5 rounded-full shrink-0 bg-stone-300 dark:bg-stone-600 flex items-center justify-center text-[10px] font-medium text-stone-600 dark:text-stone-300"
                            aria-hidden
                          >
                            {assignedUser.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate text-stone-600 dark:text-stone-300 font-medium">
                          {assignedUser.name}
                        </span>
                      </>
                    ) : (
                      <div
                        className="h-5 w-5 rounded-full shrink-0 border-[1.5px] border-dashed border-stone-300 dark:border-stone-600"
                        aria-hidden
                      />
                    )}
                  </button>
                  {showAssignMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAssignMenu(false)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800">
                        <button
                          type="button"
                          onClick={() => {
                            updateTicket.mutate({
                              ticketId: ticket!.id,
                              spaceId,
                              assigneeAgentId: null,
                              assigneeUserId: null,
                            });
                            setShowAssignMenu(false);
                          }}
                          className="cursor-pointer w-full px-3 py-2 text-left text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700 flex items-center gap-2"
                        >
                          <span
                            className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-600 shrink-0"
                            aria-hidden
                          />
                          Unassigned
                        </button>
                        {assignableUsers.length > 0 && (
                          <>
                            <div className="border-t border-stone-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:border-stone-700 dark:text-stone-500">
                              Team members
                            </div>
                            {assignableUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  updateTicket.mutate({
                                    ticketId: ticket!.id,
                                    spaceId,
                                    assigneeUserId: u.id,
                                  });
                                  setShowAssignMenu(false);
                                }}
                                className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700"
                              >
                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt=""
                                    className="h-5 w-5 rounded-full shrink-0 object-cover"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded-full shrink-0 bg-stone-300 dark:bg-stone-600 flex items-center justify-center text-[10px] font-medium text-stone-600 dark:text-stone-400">
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate">{u.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {agents.length > 0 && (
                          <>
                            <div className="border-t border-stone-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:border-stone-700 dark:text-stone-500">
                              Agents
                            </div>
                            {agents.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setShowAssignMenu(false);
                                  setPendingAgentStart({
                                    agentId: a.id,
                                    agentType: a.agentType as AgentType,
                                  });
                                }}
                                className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700"
                              >
                                <img
                                  src={getAvatarSrc(a.agentType)}
                                  alt=""
                                  className="h-5 w-5 rounded-full shrink-0 pixelated"
                                />
                                <span className="capitalize truncate">
                                  {a.agentType}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!isCreateMode && (
                <RotatingBorder
                  active={isAgentRunning}
                  color="#10b981"
                  borderRadius={6}
                  duration={2}
                >
                  <button
                    onClick={handleTriggerAgent}
                    disabled={!canTrigger && !isAgentRunning}
                    title={
                      isAgentRunning
                        ? "Agent is running"
                        : canTrigger
                          ? "Trigger agent"
                          : "No agent for this status"
                    }
                    className={cn(
                      "cursor-pointer p-1.5 rounded-md transition-colors",
                      isAgentRunning
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : canTrigger
                          ? "text-stone-400 hover:text-emerald-600 dark:text-stone-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          : "text-stone-300 dark:text-stone-700 cursor-not-allowed",
                    )}
                    aria-label={
                      isAgentRunning ? "Agent is running" : "Trigger agent"
                    }
                  >
                    {triggerAgent.isPending ? (
                      <svg
                        className="animate-spin h-[18px] w-[18px]"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          opacity="0.25"
                        />
                        <path
                          d="M8 2a6 6 0 0 1 6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.75"
                        />
                      </svg>
                    ) : isAgentRunning ? (
                      <svg
                        className="h-[18px] w-[18px]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    ) : (
                      <FiPlay size={18} />
                    )}
                  </button>
                </RotatingBorder>
              )}
              {!isCreateMode && onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="cursor-pointer p-1.5 rounded-md text-stone-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Delete ticket"
                >
                  <FiTrash2 size={18} />
                </button>
              )}
              <button
                onClick={handleClose}
                className="cursor-pointer p-1.5 rounded-md text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
                aria-label="Close panel"
              >
                <FiX size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ── title ── */}
        <div className="px-4 pb-5 pt-0 md:px-7">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={isCreateMode ? undefined : handleSave}
            className={cn(
              "w-full bg-transparent border-none outline-none resize-none",
              "text-[1.35rem] leading-snug font-semibold tracking-[-0.01em]",
              "text-stone-900 dark:text-stone-100",
              "placeholder:text-stone-300 dark:placeholder:text-stone-600",
              "caret-violet-500",
            )}
            placeholder="Untitled ticket"
          />
          <div className="flex items-center gap-3 mt-2 text-[11px] text-stone-400 dark:text-stone-500 tabular-nums">
            {createdDate && (
              <span>
                Created{" "}
                {createdDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {updatedDate && (
              <span>
                Updated{" "}
                {updatedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {ticket?.prUrl && (
              <a
                href={ticket.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                Pull request
                <FiExternalLink size={10} />
              </a>
            )}
            {saveStatus !== "idle" && (
              <span className="inline-flex items-center gap-1 ml-auto">
                {saveStatus === "saving" ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.25"
                      />
                      <path
                        d="M8 2a6 6 0 0 1 6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        opacity="0.75"
                      />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <FiCheck size={12} />
                    Saved
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* ── divider ── */}
        <div className="mx-4 md:mx-7 h-px bg-stone-200 dark:bg-stone-800" />

        {/* ── scrollable body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-5 space-y-6 md:px-7">
            {/* pipeline prompt (edit mode only) */}
            {!isCreateMode && (
              <PipelinePrompt ticketId={ticket!.id} spaceId={spaceId} />
            )}

            {/* description */}
            <section>
              <h3 className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 dark:text-stone-500 mb-2">
                Description
              </h3>
              <div
                className={cn(
                  "rounded-lg overflow-hidden p-3",
                  "bg-white dark:bg-stone-800/50",
                  "focus-within:ring-1 focus-within:ring-violet-300 dark:focus-within:ring-violet-700",
                  "transition-shadow",
                )}
              >
                <RichTextEditor
                  content={description}
                  onChange={autosaveDescription}
                  readonly={false}
                  placeholder="Write a description…"
                />
              </div>
            </section>

            {/* activity timeline (edit mode only) */}
            {!isCreateMode && (
              <ActivityTimeline
                statusHistory={ticket!.statusHistory ?? []}
                comments={ticket!.comments ?? []}
                agents={agents}
                currentUserId={user?.id}
                currentUserName={user?.name}
                currentUserAvatar={user?.avatarUrl ?? undefined}
              />
            )}
          </div>
        </div>

        {/* ── footer ── */}
        {isCreateMode ? (
          <div className="border-t border-stone-200 dark:border-stone-800 px-4 py-4 md:px-7 bg-stone-50 dark:bg-stone-900">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="cursor-pointer rounded-lg px-4 py-2 text-sm text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!title.trim() || createTicket.isPending}
                className={cn(
                  "cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all",
                  title.trim()
                    ? "text-white bg-stone-800 hover:bg-stone-900 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
                    : "text-stone-400 bg-stone-200 dark:text-stone-600 dark:bg-stone-800 cursor-not-allowed",
                )}
              >
                {createTicket.isPending ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-stone-200 dark:border-stone-800 px-4 py-4 md:px-7 bg-stone-50 dark:bg-stone-900">
            <div
              className={cn(
                "p-3 h-20",
                "rounded-lg overflow-hidden bg-white dark:bg-stone-800",
                "border border-stone-200 dark:border-stone-700",
                "focus-within:ring-1 focus-within:ring-violet-300 dark:focus-within:ring-violet-700",
                "transition-shadow",
              )}
            >
              <MentionInput
                key={commentKey}
                value={commentContent}
                onChange={setCommentContent}
                onSubmit={handleSubmitComment}
                placeholder="Write a comment... Use @developer, @pm, @tester, @reviewer to mention agents"
                disabled={addComment.isPending}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[11px] text-stone-400 dark:text-stone-500">
                Type @ to mention an agent
              </span>
              <button
                onClick={handleSubmitComment}
                disabled={!commentContent.trim() || addComment.isPending}
                className={cn(
                  "cursor-pointer inline-flex items-center gap-1.5",
                  "px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide",
                  "transition-all",
                  commentContent.trim()
                    ? "text-white bg-stone-800 hover:bg-stone-900 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
                    : "text-stone-400 bg-stone-200 dark:text-stone-600 dark:bg-stone-800 cursor-not-allowed",
                )}
              >
                <FiSend size={11} />
                {addComment.isPending ? "Sending…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete ticket"
        message={`Are you sure you want to delete "${ticket?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={!!pendingAgentStart}
        title="Start working on it?"
        message={
          pendingAgentStart
            ? `This will move the ticket to ${AGENT_DEFAULT_COLUMN[pendingAgentStart.agentType]} and start the ${AGENT_LABEL[pendingAgentStart.agentType]} agent.`
            : ""
        }
        confirmLabel="Yes, start"
        cancelLabel="No, just assign"
        onConfirm={() => {
          if (!pendingAgentStart || !ticket) return;
          updateTicket.mutate({
            ticketId: ticket.id,
            spaceId,
            assigneeAgentId: pendingAgentStart.agentId,
            startWorking: true,
          });
          setPendingAgentStart(null);
        }}
        onCancel={() => {
          if (!pendingAgentStart || !ticket) return;
          updateTicket.mutate({
            ticketId: ticket.id,
            spaceId,
            assigneeAgentId: pendingAgentStart.agentId,
          });
          setPendingAgentStart(null);
        }}
      />
    </>
  );
}

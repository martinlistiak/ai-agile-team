import { useState, useEffect, useRef, useCallback } from "react";
import {
  FiX,
  FiSend,
  FiExternalLink,
  FiCheck,
  FiTrash2,
  FiPlay,
} from "react-icons/fi";
import { useUpdateTicket, useAddComment } from "@/api/hooks/useTickets";
import { useTriggerAgent } from "@/api/hooks/useTriggerAgent";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PipelinePrompt } from "@/components/PipelinePrompt";
import { TransitionTimeline } from "@/components/TransitionTimeline";
import { getAvatarSrc } from "@/lib/avatars";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/cn";
import type { Ticket, AgentType, Priority, TicketStatus } from "@/types";

/* ── status config ─────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  backlog: { dot: "bg-stone-400", label: "Backlog" },
  planning: { dot: "bg-sky-500", label: "Planning" },
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
  ticket: Ticket;
  spaceId: string;
  onClose: () => void;
  onDelete?: (ticketId: string) => void;
}

export function TicketDetailPanel({
  ticket,
  spaceId,
  onClose,
  onDelete,
}: TicketDetailPanelProps) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [commentContent, setCommentContent] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [commentKey, setCommentKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef(ticket.description);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateTicket = useUpdateTicket();
  const addComment = useAddComment();
  const triggerAgent = useTriggerAgent();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  // sync state when ticket changes
  useEffect(() => {
    setTitle(ticket.title);
    setDescription(ticket.description);
    descriptionRef.current = ticket.description;
  }, [ticket.id, ticket.title, ticket.description]);

  // debounced autosave for description
  const autosaveDescription = useCallback(
    (markdown: string) => {
      descriptionRef.current = markdown;
      setDescription(markdown);
      setSaveStatus("saving");
      clearTimeout(saveTimerRef.current);
      clearTimeout(savedTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateTicket.mutate(
          {
            ticketId: ticket.id,
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
    [ticket.id, spaceId, updateTicket],
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
    updateTicket.mutate({ ticketId: ticket.id, spaceId, title, description });
  };

  const handleSubmitComment = () => {
    const trimmed = commentContent.trim();
    if (!trimmed) return;
    addComment.mutate(
      { ticketId: ticket.id, spaceId, content: trimmed },
      {
        onSuccess: () => {
          setCommentContent("");
          setCommentKey((k) => k + 1);
        },
      },
    );
  };

  const handleTriggerAgent = () => {
    if (triggerAgent.isPending) return;
    triggerAgent.mutate({ ticketId: ticket.id, spaceId });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    handleClose();
    onDelete?.(ticket.id);
  };

  const PLAY_ENABLED: Set<TicketStatus> = new Set(["development", "testing"]);
  const canTrigger = PLAY_ENABLED.has(ticket.status as TicketStatus);

  const status = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.backlog;
  const priority = PRIORITY_LABEL[ticket.priority] ?? PRIORITY_LABEL.medium;
  const createdDate = new Date(ticket.createdAt);
  const updatedDate = new Date(ticket.updatedAt);

  return (
    <>
      {/* backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-colors duration-280",
          isVisible ? "bg-stone-900/20 dark:bg-stone-950/40" : "bg-transparent",
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket: ${ticket.title}`}
        className={cn(
          "ticket-detail-panel",
          "fixed right-0 top-0 z-50 h-full w-full max-w-[560px]",
          "flex flex-col",
          "bg-stone-50 dark:bg-stone-900",
          "border-l border-stone-200 dark:border-stone-800",
          "shadow-[-8px_0_32px_rgba(28,25,23,0.08)]",
          "dark:shadow-[-8px_0_32px_rgba(0,0,0,0.3)]",
          "transition-transform duration-280 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isVisible ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* ── header ── */}
        <div className="flex items-start gap-3 px-7 pt-6 pb-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
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
                      {(
                        ["low", "medium", "high", "critical"] as Priority[]
                      ).map((p) => {
                        const cfg = PRIORITY_LABEL[p];
                        const isActive = ticket.priority === p;
                        return (
                          <button
                            key={p}
                            onClick={() => {
                              setShowPriorityMenu(false);
                              if (!isActive) {
                                updateTicket.mutate({
                                  ticketId: ticket.id,
                                  spaceId,
                                  priority: p,
                                });
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
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleTriggerAgent}
              disabled={!canTrigger}
              title={canTrigger ? "Trigger agent" : "No agent for this status"}
              className={cn(
                "cursor-pointer p-1.5 rounded-md transition-colors",
                canTrigger
                  ? "text-stone-400 hover:text-emerald-600 dark:text-stone-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  : "text-stone-300 dark:text-stone-700 cursor-not-allowed",
              )}
              aria-label="Trigger agent"
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
              ) : (
                <FiPlay size={18} />
              )}
            </button>
            {onDelete && (
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

        {/* ── title ── */}
        <div className="px-7 pb-5 pt-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
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
            <span>
              Created{" "}
              {createdDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>
              Updated{" "}
              {updatedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            {ticket.prUrl && (
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
        <div className="mx-7 h-px bg-stone-200 dark:bg-stone-800" />

        {/* ── scrollable body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-7 py-5 space-y-6">
            {/* pipeline prompt */}
            <PipelinePrompt ticketId={ticket.id} spaceId={spaceId} />

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

            {/* transition history */}
            <TransitionTimeline statusHistory={ticket.statusHistory ?? []} />

            {/* comments */}
            {ticket.comments.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 dark:text-stone-500 mb-3">
                  Thread
                </h3>
                <div className="space-y-3">
                  {ticket.comments.map((comment, i) => {
                    const isAgent = comment.authorType === "agent";
                    return (
                      <div
                        key={comment.id}
                        className={cn("relative", "ticket-detail-comment")}
                        style={{
                          animationDelay: `${i * 40}ms`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {isAgent ? (
                            <img
                              src={getAvatarSrc(
                                (comment.authorId ?? "pm") as AgentType,
                              )}
                              alt="Agent"
                              className="h-4 w-4 rounded-full pixelated"
                            />
                          ) : user?.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name ?? "You"}
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-4 w-4 rounded-full bg-stone-300 dark:bg-stone-600" />
                          )}
                          <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                            {isAgent
                              ? (comment.authorId ?? "agent")
                                  .charAt(0)
                                  .toUpperCase() +
                                (comment.authorId ?? "agent").slice(1)
                              : "You"}
                          </span>
                          <span className="text-[11px] text-stone-400 dark:text-stone-600 tabular-nums">
                            {new Date(comment.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "rounded-lg px-3.5 py-2.5",
                            isAgent
                              ? "bg-violet-50 dark:bg-violet-900/15 ml-6"
                              : "bg-white dark:bg-stone-800 ml-6 border border-stone-200 dark:border-stone-700",
                          )}
                        >
                          <RichTextEditor
                            content={comment.content}
                            readonly={true}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ── comment input (pinned to bottom) ── */}
        <div className="border-t border-stone-200 dark:border-stone-800 px-7 py-4 bg-stone-50 dark:bg-stone-900">
          <div
            className={cn(
              "p-1 h-16",
              "rounded-lg overflow-hidden bg-white dark:bg-stone-800",
              "border border-stone-200 dark:border-stone-700",
              "focus-within:ring-1 focus-within:ring-violet-300 dark:focus-within:ring-violet-700",
              "transition-shadow",
            )}
          >
            <RichTextEditor
              key={commentKey}
              content={commentContent}
              onChange={(markdown) => setCommentContent(markdown)}
              readonly={false}
              placeholder="Write a comment..."
            />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              Markdown supported
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
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete ticket"
        message={`Are you sure you want to delete "${ticket.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

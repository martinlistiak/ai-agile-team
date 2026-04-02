import { useState, useMemo } from "react";
import { FiUser } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { CommentContent } from "./CommentContent";
import type {
  StatusTransition,
  TicketComment,
  TransitionTrigger,
} from "@/types";

type ActivityFilter = "all" | "transitions" | "comments";

interface ActivityItem {
  type: "transition" | "comment";
  timestamp: string;
  data: StatusTransition | TicketComment;
}

const TRIGGER_LABELS: Record<TransitionTrigger, string> = {
  user: "moved",
  agent: "moved",
  pipeline: "auto-moved",
  mention: "triggered via @mention",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
  planning: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  development:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  review:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  testing:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  staged:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.backlog;
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-medium capitalize",
        colors,
      )}
    >
      {status}
    </span>
  );
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ActivityTimelineProps {
  statusHistory: StatusTransition[];
  comments: TicketComment[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
}

export function ActivityTimeline({
  statusHistory,
  comments,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: ActivityTimelineProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  // Merge and sort all activities chronologically
  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    // Add transitions
    for (const transition of statusHistory) {
      items.push({
        type: "transition",
        timestamp: transition.timestamp,
        data: transition,
      });
    }

    // Add comments
    for (const comment of comments) {
      items.push({
        type: "comment",
        timestamp: comment.createdAt,
        data: comment,
      });
    }

    // Sort by timestamp ascending (oldest first)
    items.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Apply filter
    if (filter === "transitions") {
      return items.filter((item) => item.type === "transition");
    }
    if (filter === "comments") {
      return items.filter((item) => item.type === "comment");
    }
    return items;
  }, [statusHistory, comments, filter]);

  if (statusHistory.length === 0 && comments.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 dark:text-stone-500">
          Activity
        </h3>
        <div className="flex items-center gap-1">
          {(["all", "transitions", "comments"] as ActivityFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-colors capitalize",
                filter === f
                  ? "bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-3 bottom-3 w-px bg-stone-200 dark:bg-stone-700" />

        <div className="space-y-3">
          {activities.map((activity, index) => {
            if (activity.type === "transition") {
              return (
                <TransitionItem
                  key={`transition-${index}`}
                  transition={activity.data as StatusTransition}
                />
              );
            }
            return (
              <CommentItem
                key={`comment-${(activity.data as TicketComment).id}`}
                comment={activity.data as TicketComment}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TransitionItem({ transition }: { transition: StatusTransition }) {
  const triggerLabel = TRIGGER_LABELS[transition.trigger] ?? "moved";
  const isAgent = transition.actorType === "agent";
  const actorName =
    transition.actorName || (isAgent ? transition.trigger : "User");

  return (
    <div className="relative flex gap-3">
      {/* Timeline marker - actor avatar */}
      <div className="flex-shrink-0 w-[15px] flex justify-center">
        {isAgent ? (
          <img
            src={getAvatarSrc(transition.actorId || "pm")}
            alt=""
            className="h-[15px] w-[15px] rounded-full pixelated z-10"
          />
        ) : (
          <div className="h-[15px] w-[15px] rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center z-10">
            <FiUser size={9} className="text-stone-500 dark:text-stone-400" />
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
        {/* Actor name */}
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300 capitalize">
          {actorName}
        </span>

        <span className="text-xs text-stone-400 dark:text-stone-500">
          {triggerLabel}
        </span>

        <StatusBadge status={transition.from} />
        <span className="text-stone-300 dark:text-stone-600">→</span>
        <StatusBadge status={transition.to} />

        <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto tabular-nums flex-shrink-0">
          {formatTime(transition.timestamp)}
        </span>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: {
  comment: TicketComment;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
}) {
  const isAgent = comment.authorType === "agent";
  const isCurrentUser = !isAgent && comment.authorId === currentUserId;

  return (
    <div className="relative flex gap-3">
      {/* Timeline marker - author avatar */}
      <div className="flex-shrink-0 w-[15px] flex justify-center">
        {isAgent ? (
          <img
            src={getAvatarSrc(comment.authorId || "pm")}
            alt=""
            className="h-[15px] w-[15px] rounded-full pixelated z-10"
          />
        ) : currentUserAvatar && isCurrentUser ? (
          <img
            src={currentUserAvatar}
            alt=""
            className="h-[15px] w-[15px] rounded-full object-cover z-10"
          />
        ) : (
          <div className="h-[15px] w-[15px] rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center z-10">
            <FiUser size={9} className="text-stone-500 dark:text-stone-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-stone-600 dark:text-stone-300 truncate max-w-[180px]">
            {isAgent
              ? (comment.authorId || "Agent").charAt(0).toUpperCase() +
                (comment.authorId || "Agent").slice(1)
              : isCurrentUser
                ? currentUserName || "You"
                : "User"}
          </span>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            commented
          </span>
          <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto tabular-nums flex-shrink-0">
            {formatTime(comment.createdAt)}
          </span>
        </div>

        {/* Comment content */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 overflow-hidden",
            isAgent
              ? "bg-violet-50 dark:bg-violet-900/15"
              : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700",
          )}
        >
          <CommentContent content={comment.content} />
        </div>
      </div>
    </div>
  );
}

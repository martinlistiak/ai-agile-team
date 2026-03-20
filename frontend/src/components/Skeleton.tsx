/**
 * Reusable skeleton primitives for loading states.
 *
 * Uses a single shimmer animation (GPU-friendly: background-position only)
 * and respects prefers-reduced-motion by falling back to a static surface.
 */

import { cn } from "@/lib/cn";

const shimmerBase =
  "relative overflow-hidden bg-gray-200/70 dark:bg-gray-700/50 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/[0.06] before:to-transparent before:animate-[shimmer_1.6s_ease-in-out_infinite] before:[-translate-x-full] motion-reduce:before:hidden";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("rounded-md", shimmerBase, className)}
      style={style}
      aria-hidden="true"
    />
  );
}

/* ── Space sidebar skeletons ── */

export function SpaceSidebarSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="flex flex-col items-center gap-3"
      role="status"
      aria-label="Loading spaces"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-10 w-10 rounded-xl"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
      <span className="sr-only">Loading spaces…</span>
    </div>
  );
}

/* ── Agent panel skeletons ── */

export function AgentPanelSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="flex flex-col items-center gap-3"
      role="status"
      aria-label="Loading agents"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-9 w-9 rounded-full"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
      <span className="sr-only">Loading agents…</span>
    </div>
  );
}

/* ── Ticket card skeleton ── */

function TicketCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Title lines */}
      <Skeleton className="h-3.5 w-[85%] rounded" />
      <Skeleton className="h-3.5 w-[60%] rounded" />
      {/* Priority badge + avatar row */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  );
}

/* ── Board column skeleton ── */

export function BoardColumnSkeleton({
  ticketCount = 3,
  delay = 0,
}: {
  ticketCount?: number;
  delay?: number;
}) {
  return (
    <div
      className="flex flex-col w-64 min-w-[256px] md:w-72 md:min-w-[288px] bg-gray-100 dark:bg-gray-800 rounded-xl shrink-0"
      role="status"
      aria-label="Loading column"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Skeleton className="w-2.5 h-2.5 rounded-full" />
        <Skeleton className="h-3.5 w-20 rounded" />
        <Skeleton className="h-3 w-4 rounded ml-auto" />
      </div>
      {/* Ticket cards */}
      <div className="flex-1 px-3 pb-3 space-y-2">
        {Array.from({ length: ticketCount }, (_, i) => (
          <TicketCardSkeleton key={i} delay={delay + i * 80} />
        ))}
      </div>
      <span className="sr-only">Loading tickets…</span>
    </div>
  );
}

/* ── Full kanban board skeleton (multiple columns) ── */

export function KanbanBoardSkeleton() {
  const columns = [
    { tickets: 2 },
    { tickets: 3 },
    { tickets: 2 },
    { tickets: 1 },
    { tickets: 2 },
    { tickets: 1 },
    { tickets: 1 },
  ];

  return (
    <div className="flex gap-3 p-3 md:gap-4 md:p-6 h-full overflow-x-auto">
      {columns.map((col, i) => (
        <BoardColumnSkeleton
          key={i}
          ticketCount={col.tickets}
          delay={i * 100}
        />
      ))}
    </div>
  );
}

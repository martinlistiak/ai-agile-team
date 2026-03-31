import { Link } from "react-router-dom";
import { FiX, FiZap } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getApiErrorPayload, isAgentRunQuotaError } from "@/lib/api-errors";

type Props = {
  error: unknown;
  onDismiss: () => void;
  className?: string;
};

export function AgentRunLimitUpsell({ error, onDismiss, className }: Props) {
  if (!isAgentRunQuotaError(error)) {
    return null;
  }

  const { message } = getApiErrorPayload(error);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
      role="alert"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
        <FiZap className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium leading-snug">
          Daily agent run limit reached
        </p>
        <p className="text-[13px] leading-relaxed text-amber-900/90 dark:text-amber-100/85">
          {message}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Link
            to="/billing"
            className="inline-flex items-center justify-center rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Upgrade to Team
          </Link>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-200/70">
            50 agent runs / day &amp; more capacity
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="cursor-pointer shrink-0 rounded p-1 text-amber-800/70 transition-colors hover:bg-amber-200/60 hover:text-amber-950 dark:text-amber-200/60 dark:hover:bg-amber-800/40 dark:hover:text-amber-50"
        aria-label="Dismiss"
      >
        <FiX className="h-4 w-4" />
      </button>
    </div>
  );
}

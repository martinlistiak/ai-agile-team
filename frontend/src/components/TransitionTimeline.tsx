import { FiUser, FiCpu, FiZap } from "react-icons/fi";
import type { StatusTransition, TransitionTrigger } from "@/types";

const TRIGGER_CONFIG: Record<
  TransitionTrigger,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  user: { icon: FiUser, label: "User" },
  agent: { icon: FiCpu, label: "Agent" },
  pipeline: { icon: FiZap, label: "Pipeline" },
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  backlog: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  planning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  development:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  review:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  testing:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  staged:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function StatusBadge({ status }: { status: string }) {
  const colors =
    STATUS_BADGE_COLORS[status] ??
    "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors}`}
    >
      {status}
    </span>
  );
}

interface TransitionTimelineProps {
  statusHistory: StatusTransition[];
}

export function TransitionTimeline({ statusHistory }: TransitionTimelineProps) {
  if (!statusHistory || statusHistory.length === 0) return null;

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        Transition History
      </label>
      <div className="mt-2 relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-600" />

        <div className="space-y-3">
          {statusHistory.map((transition, index) => {
            const triggerCfg =
              TRIGGER_CONFIG[transition.trigger] ?? TRIGGER_CONFIG.user;
            const TriggerIcon = triggerCfg.icon;

            return (
              <div key={index} className="relative flex items-start gap-3 pl-7">
                {/* Timeline dot */}
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-white dark:border-gray-800 z-10" />

                <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={transition.from} />
                    <span className="text-xs text-gray-400">→</span>
                    <StatusBadge status={transition.to} />
                    <span
                      className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ml-auto"
                      title={triggerCfg.label}
                    >
                      <TriggerIcon className="text-xs" />
                      {triggerCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(transition.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { FiX } from "react-icons/fi";
import {
  usePipelineConfig,
  useUpdatePipelineConfig,
} from "@/api/hooks/usePipeline";
import { cn } from "@/lib/cn";

/* ── stage definitions ── */

const STAGES = [
  {
    key: "planning",
    label: "Planning",
    shortLabel: "Plan",
    description: "PM agent plans tickets",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "development",
    label: "Development",
    shortLabel: "Dev",
    description: "Developer agent auto-implements",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="4" x2="10" y2="20" />
      </svg>
    ),
  },
  {
    key: "review",
    label: "Code Review",
    shortLabel: "Review",
    description: "Manual code review stage",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="11" y1="8" x2="11" y2="14" />
      </svg>
    ),
  },
  {
    key: "testing",
    label: "Testing",
    shortLabel: "Test",
    description: "Tester agent auto-tests",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    key: "staged",
    label: "Staged",
    shortLabel: "Stage",
    description: "Ready for deployment",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
] as const;

/* ── connector SVG between nodes ── */

function FlowConnector({
  active,
  nextActive,
  animDelay,
}: {
  active: boolean;
  nextActive: boolean;
  animDelay: number;
}) {
  const bothActive = active && nextActive;

  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{ width: 40 }}
    >
      <svg
        width="40"
        height="24"
        viewBox="0 0 40 24"
        fill="none"
        className="overflow-visible"
      >
        {/* base line */}
        <line
          x1="0"
          y1="12"
          x2="40"
          y2="12"
          stroke={bothActive ? "oklch(0.65 0.15 250)" : "oklch(0.75 0 0)"}
          strokeWidth="2"
          strokeDasharray={bothActive ? "none" : "4 3"}
          className="transition-all duration-500"
          style={{ transitionDelay: `${animDelay}ms` }}
        />
        {/* animated pulse traveling along the line when both sides active */}
        {bothActive && (
          <circle r="3" fill="oklch(0.7 0.18 250)">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path="M0,12 L40,12"
            />
            <animate
              attributeName="opacity"
              values="0.9;0.3;0.9"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        {/* chevron at end */}
        <polyline
          points="32,7 38,12 32,17"
          fill="none"
          stroke={bothActive ? "oklch(0.65 0.15 250)" : "oklch(0.75 0 0)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
          style={{ transitionDelay: `${animDelay}ms` }}
        />
      </svg>
    </div>
  );
}

/* ── single pipeline node ── */

function PipelineNode({
  stage,
  active,
  onToggle,
  index,
  isVisible,
}: {
  stage: (typeof STAGES)[number];
  active: boolean;
  onToggle: () => void;
  index: number;
  isVisible: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const enterDelay = index * 80;

  return (
    <div
      className="flex flex-col items-center gap-2 shrink-0"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${enterDelay}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${enterDelay}ms`,
      }}
    >
      {/* node circle */}
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "cursor-pointer relative flex items-center justify-center rounded-2xl transition-all duration-300",
          "w-16 h-16",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400",
          active
            ? "text-white"
            : "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 border-2 border-dashed border-gray-200 dark:border-gray-700",
        )}
        style={
          active
            ? {
                background: "oklch(0.52 0.14 250)",
                boxShadow: hovered
                  ? "0 0 0 4px oklch(0.52 0.14 250 / 0.18), 0 8px 24px -4px oklch(0.52 0.14 250 / 0.3)"
                  : "0 0 0 0px oklch(0.52 0.14 250 / 0), 0 4px 12px -2px oklch(0.52 0.14 250 / 0.2)",
              }
            : {
                boxShadow: hovered ? "0 0 0 3px oklch(0.75 0 0 / 0.1)" : "none",
              }
        }
        aria-label={`${active ? "Disable" : "Enable"} ${stage.label} stage`}
        aria-pressed={active}
        role="switch"
      >
        {stage.icon}

        {/* active indicator dot */}
        <span
          className={cn(
            "absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 transition-all duration-300",
            active
              ? "bg-emerald-400 scale-100"
              : "bg-gray-300 dark:bg-gray-600 scale-75",
          )}
        />
      </button>

      {/* label */}
      <span
        className={cn(
          "text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300",
          active
            ? "text-gray-800 dark:text-gray-200"
            : "text-gray-400 dark:text-gray-500",
        )}
      >
        {stage.shortLabel}
      </span>
    </div>
  );
}

/* ── expanded detail panel ── */

function StageDetail({
  stage,
  active,
  onToggle,
}: {
  stage: (typeof STAGES)[number];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-all duration-300",
        active
          ? "bg-primary-50/60 dark:bg-primary-900/10"
          : "bg-gray-50/60 dark:bg-gray-800/30",
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            active
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400",
          )}
        >
          {stage.label}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {stage.description}
        </p>
      </div>

      {/* toggle switch */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "cursor-pointer relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          active ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
        )}
        role="switch"
        aria-checked={active}
        aria-label={`${active ? "Disable" : "Enable"} ${stage.label}`}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300",
            active ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* ── main component ── */

export function PipelineSettings({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const { data: config = {} } = usePipelineConfig(spaceId);
  const updateConfig = useUpdatePipelineConfig();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    // stagger entrance
    const t = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // reveal detail section after nodes animate in
  useEffect(() => {
    const t = setTimeout(() => setShowDetail(true), STAGES.length * 80 + 300);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  // click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [handleClose]);

  // escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  const toggleStage = (key: string) => {
    updateConfig.mutate({
      spaceId,
      config: { ...config, [key]: !config[key] },
    });
  };

  const activeCount = STAGES.filter((s) => config[s.key]).length;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-250",
        isClosing ? "bg-black/0" : "bg-black/30 dark:bg-black/50",
      )}
    >
      <div
        ref={panelRef}
        className={cn(
          "w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 transition-all duration-250",
          isClosing
            ? "opacity-0 scale-[0.97]"
            : isVisible
              ? "opacity-100 scale-100"
              : "opacity-0 scale-[0.97]",
        )}
        style={{
          boxShadow:
            "0 24px 80px -12px oklch(0.2 0 0 / 0.25), 0 0 0 1px oklch(0.5 0 0 / 0.06)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Pipeline settings"
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Pipeline
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {activeCount} of {STAGES.length} stages active
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close pipeline settings"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* flow visualization */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center overflow-x-auto pt-1 pb-2">
            {/* entry point */}
            <div
              className="flex flex-col items-center gap-2 shrink-0 mr-2"
              style={{
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-gray-400 dark:text-gray-500"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Ticket
              </span>
            </div>

            <FlowConnector
              active={true}
              nextActive={!!config[STAGES[0].key]}
              animDelay={0}
            />

            {STAGES.map((stage, i) => (
              <div key={stage.key} className="contents">
                <PipelineNode
                  stage={stage}
                  active={!!config[stage.key]}
                  onToggle={() => toggleStage(stage.key)}
                  index={i}
                  isVisible={isVisible}
                />
                {i < STAGES.length - 1 && (
                  <FlowConnector
                    active={!!config[stage.key]}
                    nextActive={!!config[STAGES[i + 1].key]}
                    animDelay={(i + 1) * 80}
                  />
                )}
              </div>
            ))}

            {/* exit point */}
            <FlowConnector
              active={!!config[STAGES[STAGES.length - 1].key]}
              nextActive={true}
              animDelay={STAGES.length * 80}
            />
            <div
              className="flex flex-col items-center gap-2 shrink-0 ml-2"
              style={{
                opacity: isVisible ? 1 : 0,
                transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${STAGES.length * 80}ms`,
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-emerald-500 dark:text-emerald-400"
                >
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
                Done
              </span>
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="mx-6 h-px bg-gray-100 dark:bg-gray-800" />

        {/* detail toggles */}
        <div
          className="px-6 py-4 space-y-2"
          style={{
            opacity: showDetail ? 1 : 0,
            transform: showDetail ? "translateY(0)" : "translateY(8px)",
            transition:
              "opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
            Stage configuration
          </p>
          {STAGES.map((stage) => (
            <StageDetail
              key={stage.key}
              stage={stage}
              active={!!config[stage.key]}
              onToggle={() => toggleStage(stage.key)}
            />
          ))}
        </div>

        {/* footer hint */}
        <div className="px-6 pb-5 pt-2">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
            Active stages auto-trigger agents when tickets move into them. Click
            a node or use the toggles to configure.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useBillingUsage } from "@/api/hooks/useBilling";

interface DonutChartProps {
  used: number;
  limit: number;
  size?: number;
  strokeWidth?: number;
}

function DonutChart({
  used,
  limit,
  size = 40,
  strokeWidth = 5,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(used / limit, 1);
  const strokeDashoffset = circumference * (1 - percentage);

  // Color based on usage level
  let strokeColor = "stroke-emerald-500";
  if (percentage >= 0.9) {
    strokeColor = "stroke-red-500";
  } else if (percentage >= 0.7) {
    strokeColor = "stroke-amber-500";
  }

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-gray-200 dark:stroke-gray-700"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className={`${strokeColor} transition-all duration-300`}
      />
    </svg>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

export function UsageMeter() {
  const navigate = useNavigate();
  const { data: usage, isLoading } = useBillingUsage();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ left: 0, bottom: 0 });

  const updatePosition = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        left: rect.right + 12,
        bottom: window.innerHeight - rect.bottom,
      });
    }
  }, []);

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };
  const handleMouseLeave = () => setVisible(false);

  if (isLoading || !usage) {
    return (
      <div className="flex h-10 w-10 items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    );
  }

  const { totalTokens, monthlyTokenLimit, tokenUsagePercent } = usage;
  const remaining = Math.max(monthlyTokenLimit - totalTokens, 0);

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={() => navigate("/billing")}
          className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:border-gray-300 dark:hover:border-gray-600"
          aria-label={`Token usage: ${tokenUsagePercent}% of monthly limit`}
        >
          <DonutChart
            used={totalTokens}
            limit={monthlyTokenLimit}
            size={28}
            strokeWidth={4}
          />
        </button>
      </div>
      {visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-9999 rounded-lg bg-gray-900 dark:bg-gray-100 p-3 shadow-lg min-w-[180px]"
            style={{ left: coords.left, bottom: coords.bottom }}
          >
            <p className="text-xs font-semibold text-white dark:text-gray-900 mb-2">
              Token Usage
            </p>
            <div className="flex items-center gap-3">
              <DonutChart
                used={totalTokens}
                limit={monthlyTokenLimit}
                size={36}
                strokeWidth={4}
              />
              <div>
                <p className="text-sm font-semibold text-white dark:text-gray-900">
                  {formatTokens(totalTokens)} /{" "}
                  {formatTokens(monthlyTokenLimit)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  tokens this period
                </p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700 dark:border-gray-300">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {remaining > 0 ? (
                  <>{formatTokens(remaining)} tokens remaining</>
                ) : (
                  <span className="text-red-400 dark:text-red-600">
                    Monthly limit reached
                  </span>
                )}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {tokenUsagePercent >= 90
                  ? "Consider upgrading your plan"
                  : "Resets at billing period end"}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

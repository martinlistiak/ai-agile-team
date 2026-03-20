import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import { useAgents } from "@/api/hooks/useAgents";
import { AgentInspector } from "@/features/agents/AgentInspector";
import { CustomAgentsPanel } from "@/features/agents/CustomAgentsPanel";
import { cn } from "@/lib/cn";
import { getStatusRingClass, getAvatarSrc } from "@/lib/avatars";
import { AgentPanelSkeleton } from "@/components/Skeleton";
import RotatingBorder from "@/components/RotatingBorder";
import type { Agent } from "@/types";

const AGENT_CONFIG: Record<
  string,
  { name: string; color: string; shortLabel: string }
> = {
  pm: { name: "Product Manager", color: "bg-blue-500", shortLabel: "PM" },
  developer: { name: "Developer", color: "bg-purple-500", shortLabel: "DE" },
  reviewer: { name: "Reviewer", color: "bg-amber-500", shortLabel: "CR" },
  tester: { name: "Tester", color: "bg-green-500", shortLabel: "QA" },
};

const AGENT_BORDER_COLORS: Record<string, string> = {
  pm: "#3b82f6",
  developer: "#8b5cf6",
  reviewer: "#f59e0b",
  tester: "#22c55e",
  custom: "#8b5cf6",
};

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        left: rect.right + 12,
        top: rect.top + rect.height / 2,
      });
    }
  }, []);

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };
  const handleMouseLeave = () => setVisible(false);

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-9999 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-sm dark:bg-gray-100 dark:text-gray-900"
            style={{ left: coords.left, top: coords.top }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}

export function AgentBadge({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: (agent: Agent) => void;
}) {
  const config = AGENT_CONFIG[agent.agentType] || AGENT_CONFIG.pm;
  const isActive = agent.status === "active";
  const borderColor =
    AGENT_BORDER_COLORS[agent.agentType] ?? AGENT_BORDER_COLORS.custom;

  return (
    <RailTooltip label={`${config.name} • ${agent.status}`}>
      <RotatingBorder
        active={isActive}
        color={borderColor}
        borderRadius={9999}
        duration={3}
      >
        <button
          type="button"
          onClick={() => onClick(agent)}
          className="cursor-pointer relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-[1.03]"
          aria-label={`${config.name} ${agent.status}`}
          title={`${config.name} • ${agent.status}`}
        >
          <img
            src={getAvatarSrc(agent.agentType)}
            alt={config.name}
            className={cn(
              "h-9 w-9 rounded-full pixelated shadow-sm",
              !isActive && getStatusRingClass(agent.status),
            )}
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900",
              agent.status === "idle" && "bg-gray-400",
              agent.status === "active" && "bg-green-500",
              agent.status === "error" && "bg-red-500",
            )}
          />
        </button>
      </RotatingBorder>
    </RailTooltip>
  );
}

export function AgentPanel() {
  const { spaceId } = useParams();
  const { data: agents, isLoading: agentsLoading } = useAgents(spaceId || null);
  const [inspectedAgent, setInspectedAgent] = useState<Agent | null>(null);
  const [showCustomAgents, setShowCustomAgents] = useState(false);

  if (!spaceId) return null;

  return (
    <>
      <div className="w-14 border-r border-gray-200 bg-white px-1 py-4 dark:border-gray-800 dark:bg-gray-950/60 shrink-0">
        <div className="flex h-full flex-col items-center gap-3 overflow-y-auto py-1">
          {agentsLoading ? (
            <AgentPanelSkeleton />
          ) : (
            agents?.map((agent) => (
              <AgentBadge
                key={agent.id}
                agent={agent}
                onClick={setInspectedAgent}
              />
            ))
          )}
          <RailTooltip label="Custom agents">
            <button
              type="button"
              onClick={() => setShowCustomAgents(true)}
              className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-gray-300 bg-transparent text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-gray-700 dark:text-gray-400"
              aria-label="Custom agents"
              title="Custom agents"
            >
              <FiPlus size={14} />
            </button>
          </RailTooltip>
        </div>
      </div>
      {inspectedAgent && (
        <AgentInspector
          agent={inspectedAgent}
          onClose={() => setInspectedAgent(null)}
        />
      )}
      {showCustomAgents && (
        <CustomAgentsPanel
          spaceId={spaceId}
          onClose={() => setShowCustomAgents(false)}
        />
      )}
    </>
  );
}

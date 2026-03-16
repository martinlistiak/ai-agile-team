import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { useAgents } from "@/api/hooks/useAgents";
import { AgentInspector } from "@/features/agents/AgentInspector";
import { cn } from "@/lib/cn";
import { getStatusRingClass, getAvatarSrc } from "@/lib/avatars";
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

  return (
    <RailTooltip label={`${config.name} • ${agent.status}`}>
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
            getStatusRingClass(agent.status),
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
    </RailTooltip>
  );
}

export function AgentPanel() {
  const { spaceId } = useParams();
  const { data: agents } = useAgents(spaceId || null);
  const [inspectedAgent, setInspectedAgent] = useState<Agent | null>(null);

  if (!spaceId) return null;

  return (
    <>
      <div className="w-14 border-r border-gray-200 bg-white px-1 py-4 dark:border-gray-800 dark:bg-gray-950/60 shrink-0">
        <div className="flex h-full flex-col items-center gap-3 overflow-y-auto py-1">
          {agents?.map((agent) => (
            <AgentBadge
              key={agent.id}
              agent={agent}
              onClick={setInspectedAgent}
            />
          ))}
        </div>
      </div>
      {inspectedAgent && (
        <AgentInspector
          agent={inspectedAgent}
          onClose={() => setInspectedAgent(null)}
        />
      )}
    </>
  );
}

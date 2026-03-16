import { useState, useEffect, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import { FiPlay } from "react-icons/fi";
import { useTriggerAgent } from "@/api/hooks/useTriggerAgent";
import { getSocket } from "@/lib/socket";
import { getAvatarSrc } from "@/lib/avatars";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import ElectricBorder from "@/components/ElectricBorder";
import type { Agent, Ticket, TicketStatus } from "@/types";
import { AgentBadge } from "../agents/AgentPanel";

const AGENT_BORDER_COLORS: Record<string, string> = {
  pm: "#3b82f6",
  developer: "#8b5cf6",
  reviewer: "#f59e0b",
  tester: "#22c55e",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

/** Statuses that have a mapped agent in STAGE_AGENT_MAP */
const PLAY_ENABLED_STATUSES: Set<TicketStatus> = new Set([
  "development",
  "testing",
]);

interface TicketCardProps {
  ticket: Ticket;
  spaceId?: string;
  isDragging?: boolean;
  onClick?: () => void;
  agents?: Agent[];
  onDelete?: (ticketId: string) => void;
  activeTicketId?: string | null;
}

export function TicketCard({
  ticket,
  spaceId,
  isDragging,
  onClick,
  agents = [],
  onDelete,
  activeTicketId,
}: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: ticket.id,
  });
  const triggerAgent = useTriggerAgent();
  const [agentActive, setAgentActive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDisabled = !PLAY_ENABLED_STATUSES.has(ticket.status);
  const isLoading = triggerAgent.isPending || agentActive;

  // Subscribe to agent_status WebSocket events to track when agent finishes
  useEffect(() => {
    const socket = getSocket();

    const handleAgentStatus = (payload: {
      agentId: string;
      status: string;
    }) => {
      // When agent becomes idle or errors out, stop the spinner
      if (payload.status !== "active") {
        setAgentActive(false);
      }
    };

    socket.on("agent_status", handleAgentStatus);
    return () => {
      socket.off("agent_status", handleAgentStatus);
    };
  }, []);

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDisabled || isLoading || !spaceId) return;

      setAgentActive(true);
      triggerAgent.mutate(
        { ticketId: ticket.id, spaceId },
        {
          onError: () => setAgentActive(false),
        },
      );
    },
    [isDisabled, isLoading, spaceId, ticket.id, triggerAgent],
  );

  // Resolve assigned agent from agents prop
  const assignedAgent = ticket.assigneeAgentId
    ? (agents.find((a) => a.id === ticket.assigneeAgentId) ?? null)
    : null;

  const isHiddenDuringDrag = activeTicketId === ticket.id;

  const confirmDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    onDelete?.(ticket.id);
  }, [onDelete, ticket.id]);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Tooltip text for the play button
  const tooltipText = isLoading
    ? "Agent is busy — request will be queued"
    : isDisabled
      ? "No agent available for this status"
      : "Trigger agent";

  const isBeingWorkedOn = assignedAgent?.status === "active";

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "group relative bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
        isDragging && "shadow-lg opacity-80 rotate-2",
        isHiddenDuringDrag && "opacity-0",
      )}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
        {ticket.title}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            PRIORITY_COLORS[ticket.priority],
          )}
        >
          {ticket.priority}
        </span>
        <div className="flex items-center gap-1.5">
          {assignedAgent && (
            <ElectricBorder
              color={AGENT_BORDER_COLORS[assignedAgent.agentType] ?? "#8b5cf6"}
              speed={0.4}
              chaos={0.02}
              borderRadius={9999}
            >
              <img
                src={getAvatarSrc(assignedAgent.agentType)}
                alt={`${assignedAgent.agentType} agent`}
                className="h-5 w-5 rounded-full pixelated"
              />
            </ElectricBorder>
          )}
          {!isDisabled && (
            <button
              onClick={handlePlay}
              disabled={isDisabled}
              title={tooltipText}
              className={cn(
                "cursor-pointer p-1 rounded-md transition-colors",
                isDisabled
                  ? "opacity-40 cursor-not-allowed text-gray-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-primary-500",
              )}
            >
              {isLoading ? (
                // agent avatar
                <AgentBadge agent={assignedAgent!} onClick={() => {}} />
              ) : (
                <FiPlay className="text-sm" />
              )}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete ticket"
        message={`Are you sure you want to delete "${ticket.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );

  const agentColor =
    AGENT_BORDER_COLORS[assignedAgent?.agentType ?? ""] ?? "#8b5cf6";

  if (isBeingWorkedOn || isLoading) {
    return (
      <ElectricBorder
        color={agentColor}
        speed={0.8}
        chaos={0.06}
        borderRadius={8}
      >
        {card}
      </ElectricBorder>
    );
  }

  return card;
}

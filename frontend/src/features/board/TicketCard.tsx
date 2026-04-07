import { useState, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { FiPlay, FiLoader } from "react-icons/fi";
import { useTriggerAgent } from "@/api/hooks/useTriggerAgent";
import { useUpdateTicket } from "@/api/hooks/useTickets";
import { getSocket } from "@/lib/socket";
import { getAvatarSrc } from "@/lib/avatars";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import RotatingBorder from "@/components/RotatingBorder";
import type { Agent, Ticket, TicketStatus } from "@/types";

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
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (ticketId: string) => void;
}

export function TicketCard({
  ticket,
  spaceId,
  isDragging,
  onClick,
  agents = [],
  onDelete,
  activeTicketId,
  selectionMode,
  selected,
  onToggleSelect,
}: TicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: ticket.id });
  const triggerAgent = useTriggerAgent();
  const updateTicket = useUpdateTicket();
  const [agentActive, setAgentActive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const isDisabled = !PLAY_ENABLED_STATUSES.has(ticket.status);
  const isLoading = triggerAgent.isPending || agentActive;

  // Subscribe to agent_status WebSocket events to track when agent finishes
  useEffect(() => {
    const socket = getSocket();

    const handleAgentStatus = (payload: {
      agentId: string;
      status: string;
      ticketId?: string;
    }) => {
      // Only react to events for this specific ticket
      if (payload.ticketId !== ticket.id) return;

      if (payload.status === "active") {
        setAgentActive(true);
      } else {
        setAgentActive(false);
      }
    };

    socket.on("agent_status", handleAgentStatus);
    return () => {
      socket.off("agent_status", handleAgentStatus);
    };
  }, [ticket.id]);

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

  const handleAssigneeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAssigneeDropdown((prev) => !prev);
  }, []);

  const handleReassign = useCallback(
    (agentId: string | null) => {
      if (!spaceId) return;
      updateTicket.mutate({
        ticketId: ticket.id,
        spaceId,
        assigneeAgentId: agentId,
      });
      setShowAssigneeDropdown(false);
    },
    [spaceId, ticket.id, updateTicket],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showAssigneeDropdown) return;
    const handleClickOutside = () => setShowAssigneeDropdown(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showAssigneeDropdown]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Tooltip text for the play button
  const tooltipText = isLoading
    ? "Agent is busy — request will be queued"
    : isDisabled
      ? "No agent available for this status"
      : "Trigger agent";

  const isBeingWorkedOn = agentActive;

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "group relative bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
        (isDragging || isSortDragging) && "shadow-lg opacity-80 rotate-2",
        isHiddenDuringDrag && "opacity-0",
        selected && "ring-2 ring-primary-500 border-primary-400",
      )}
    >
      {selectionMode && (
        <button
          type="button"
          aria-label={selected ? "Deselect ticket" : "Select ticket"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(ticket.id);
          }}
          className="absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-800 transition-colors hover:border-primary-500"
        >
          {selected && (
            <span className="block h-3 w-3 rounded-full bg-primary-500" />
          )}
        </button>
      )}
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
          {/* Assignee avatar - clickable to reassign */}
          <div className="relative">
            <button
              type="button"
              onClick={handleAssigneeClick}
              className="cursor-pointer rounded-full hover:ring-2 hover:ring-primary-300 transition-all"
              title={
                assignedAgent
                  ? `Assigned to ${assignedAgent.agentType}`
                  : "Unassigned - click to assign"
              }
            >
              {assignedAgent ? (
                <RotatingBorder
                  active={agentActive}
                  color={
                    AGENT_BORDER_COLORS[assignedAgent.agentType] ?? "#8b5cf6"
                  }
                  borderRadius={9999}
                >
                  <img
                    src={getAvatarSrc(assignedAgent.agentType)}
                    alt={`${assignedAgent.agentType} agent`}
                    className="h-6 w-6 rounded-full pixelated"
                  />
                </RotatingBorder>
              ) : (
                <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">?</span>
                </div>
              )}
            </button>

            {/* Reassign dropdown */}
            {showAssigneeDropdown && (
              <div
                className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-3 py-1 text-[10px] font-medium text-gray-400 uppercase">
                  Assign to
                </p>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleReassign(agent.id)}
                    className={cn(
                      "cursor-pointer w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
                      ticket.assigneeAgentId === agent.id &&
                        "bg-primary-50 dark:bg-primary-900/20",
                    )}
                  >
                    <img
                      src={getAvatarSrc(agent.agentType)}
                      alt={agent.agentType}
                      className="h-5 w-5 rounded-full pixelated"
                    />
                    <span className="capitalize">{agent.agentType}</span>
                  </button>
                ))}
                {ticket.assigneeAgentId && (
                  <button
                    type="button"
                    onClick={() => handleReassign(null)}
                    className="cursor-pointer w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 mt-1"
                  >
                    Unassign
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Play button */}
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
                <FiLoader className="text-sm animate-spin" />
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
      <RotatingBorder active color={agentColor} borderRadius={8} duration={3}>
        {card}
      </RotatingBorder>
    );
  }

  return card;
}

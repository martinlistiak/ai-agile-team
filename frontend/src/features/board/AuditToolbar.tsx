import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiCheckCircle,
  FiChevronUp,
  FiClock,
  FiEdit,
  FiPlus,
  FiZap,
} from "react-icons/fi";
import { getSocket } from "@/lib/socket";
import type { AgentType } from "@/types";

const MAX_EVENTS = 200;

export type AuditEventType =
  | "execution_action"
  | "pipeline_completed"
  | "ticket_created"
  | "ticket_updated";

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  summary: string;
  agentType?: AgentType;
  ticketId?: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventTypeIcon({ type }: { type: AuditEventType }) {
  switch (type) {
    case "execution_action":
      return <FiZap className="text-yellow-500" size={14} />;
    case "pipeline_completed":
      return <FiCheckCircle className="text-green-500" size={14} />;
    case "ticket_created":
      return <FiPlus className="text-blue-500" size={14} />;
    case "ticket_updated":
      return <FiEdit className="text-purple-500" size={14} />;
  }
}

function buildSummary(
  type: AuditEventType,
  payload: Record<string, unknown>,
): string {
  switch (type) {
    case "execution_action": {
      const tool = (payload.tool as string) || "action";
      const input = (payload.inputSummary as string) || "";
      return input
        ? `Agent executed ${tool}: ${input}`
        : `Agent executed ${tool}`;
    }
    case "pipeline_completed": {
      const stage = (payload.completedStage as string) || "stage";
      const next = payload.nextStage as string | null;
      return next
        ? `Pipeline completed ${stage} → ${next}`
        : `Pipeline completed ${stage}`;
    }
    case "ticket_created":
      return `Ticket created`;
    case "ticket_updated":
      return `Ticket updated`;
  }
}

export function AuditToolbar({ spaceId }: { spaceId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const addEvent = useCallback(
    (type: AuditEventType, payload: Record<string, unknown>) => {
      const event: AuditEvent = {
        id: crypto.randomUUID(),
        timestamp: (payload.timestamp as string) || new Date().toISOString(),
        type,
        summary: buildSummary(type, payload),
        agentType: payload.agentType as AgentType | undefined,
        ticketId: payload.ticketId as string | undefined,
      };
      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
    },
    [],
  );

  useEffect(() => {
    const socket = getSocket();

    const handleExecutionAction = (payload: Record<string, unknown>) => {
      addEvent("execution_action", payload);
    };
    const handlePipelineCompleted = (payload: Record<string, unknown>) => {
      addEvent("pipeline_completed", payload);
    };
    const handleTicketCreated = (payload: Record<string, unknown>) => {
      addEvent("ticket_created", payload);
    };
    const handleTicketUpdated = (payload: Record<string, unknown>) => {
      addEvent("ticket_updated", payload);
    };

    socket.on("execution_action", handleExecutionAction);
    socket.on("pipeline_completed", handlePipelineCompleted);
    socket.on("ticket_created", handleTicketCreated);
    socket.on("ticket_updated", handleTicketUpdated);

    return () => {
      socket.off("execution_action", handleExecutionAction);
      socket.off("pipeline_completed", handlePipelineCompleted);
      socket.off("ticket_created", handleTicketCreated);
      socket.off("ticket_updated", handleTicketUpdated);
    };
  }, [spaceId, addEvent]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer flex items-center gap-1 border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Open audit toolbar"
      >
        <FiChevronUp size={12} />
        <FiActivity size={12} />
        <span>Audit Log</span>
      </button>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="cursor-pointer flex w-full items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Close audit toolbar"
      >
        <FiChevronUp size={12} className="rotate-180 transition-transform" />
        <FiActivity size={12} />
        <span>Audit Log</span>
        {events.length > 0 && (
          <span className="text-gray-400 dark:text-gray-500">
            ({events.length})
          </span>
        )}
      </button>

      <div ref={listRef} className="max-h-40 overflow-y-auto px-4 pb-2">
        {events.length === 0 ? (
          <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
            No events yet. Actions will appear here in real time.
          </p>
        ) : (
          <div className="space-y-0.5">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="shrink-0 text-gray-400 dark:text-gray-500">
                  <FiClock size={10} className="mr-0.5 inline" />
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className="shrink-0">
                  <EventTypeIcon type={event.type} />
                </span>
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {event.summary}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

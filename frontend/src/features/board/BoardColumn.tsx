import { useDroppable } from "@dnd-kit/core";
import { TicketCard } from "./TicketCard";
import { cn } from "@/lib/cn";
import type { Agent, Ticket } from "@/types";

interface BoardColumnProps {
  id: string;
  label: string;
  color: string;
  tickets: Ticket[];
  spaceId?: string;
  onTicketClick: (ticket: Ticket) => void;
  activeTicketId?: string | null;
  agents?: Agent[];
  onDelete?: (ticketId: string) => void;
}

export function BoardColumn({
  id,
  label,
  color,
  tickets,
  spaceId,
  onTicketClick,
  activeTicketId,
  agents,
  onDelete,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-72 min-w-[288px] bg-gray-100 dark:bg-gray-800 rounded-xl shrink-0 transition-colors",
        isOver &&
          "bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </h3>
        <span className="text-xs text-gray-400 ml-auto">{tickets.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            spaceId={spaceId}
            onClick={() => onTicketClick(ticket)}
            activeTicketId={activeTicketId}
            agents={agents}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

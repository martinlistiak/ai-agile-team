import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  useTickets,
  useMoveTicket,
  useDeleteTicket,
} from "@/api/hooks/useTickets";
import { useAgents } from "@/api/hooks/useAgents";
import { BoardColumn } from "./BoardColumn";
import { TicketCard } from "./TicketCard";
import { TicketDetailPanel } from "./TicketDetailPanel";
import type { Ticket, TicketStatus } from "@/types";

const COLUMNS: { id: TicketStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-gray-400" },
  { id: "planning", label: "Planning", color: "bg-blue-400" },
  { id: "development", label: "Development", color: "bg-purple-400" },
  { id: "review", label: "Code Review", color: "bg-orange-400" },
  { id: "testing", label: "Testing", color: "bg-yellow-400" },
  { id: "staged", label: "Staged", color: "bg-teal-400" },
  { id: "done", label: "Done", color: "bg-green-400" },
];

export function KanbanBoard({ spaceId }: { spaceId: string }) {
  const { data: tickets = [] } = useTickets(spaceId);
  const { data: agents = [] } = useAgents(spaceId);
  const moveTicket = useMoveTicket();
  const deleteTicket = useDeleteTicket();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const selectedTicket = selectedTicketId
    ? (tickets.find((t) => t.id === selectedTicketId) ?? null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const ticketsByStatus = COLUMNS.reduce<Record<TicketStatus, Ticket[]>>(
    (acc, col) => {
      acc[col.id] = tickets.filter((t) => t.status === col.id);
      return acc;
    },
    {} as Record<TicketStatus, Ticket[]>,
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === ticketId);

    if (ticket && ticket.status !== newStatus) {
      moveTicket.mutate({ ticketId, status: newStatus, spaceId });
    }
  };

  const handleDelete = (ticketId: string) => {
    setSelectedTicketId(null);
    deleteTicket.mutate({ ticketId, spaceId });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-6 h-full overflow-x-auto">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              tickets={ticketsByStatus[col.id] || []}
              spaceId={spaceId}
              onTicketClick={(t) => setSelectedTicketId(t.id)}
              activeTicketId={activeTicket?.id ?? null}
              agents={agents}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          spaceId={spaceId}
          onClose={() => setSelectedTicketId(null)}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

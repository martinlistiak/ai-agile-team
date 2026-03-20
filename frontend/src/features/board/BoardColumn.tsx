import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FiPlus } from "react-icons/fi";
import { TicketCard } from "./TicketCard";
import { useCreateTicket } from "@/api/hooks/useTickets";
import { cn } from "@/lib/cn";
import type { Agent, Ticket, TicketStatus } from "@/types";

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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const createTicket = useCreateTicket();

  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets]);

  const handleQuickAdd = () => {
    if (!quickTitle.trim() || !spaceId) return;
    createTicket.mutate(
      {
        spaceId,
        title: quickTitle.trim(),
        status: id as TicketStatus,
      },
      {
        onSuccess: () => {
          setQuickTitle("");
          setQuickAddOpen(false);
        },
      },
    );
  };

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
        <SortableContext
          items={ticketIds}
          strategy={verticalListSortingStrategy}
        >
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
        </SortableContext>
        {/* Quick-add inline input */}
        {quickAddOpen ? (
          <div className="rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 p-2 shadow-sm">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
                if (e.key === "Escape") {
                  setQuickAddOpen(false);
                  setQuickTitle("");
                }
              }}
              placeholder="Task title…"
              autoFocus
              className="w-full bg-transparent border-none outline-none text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400"
            />
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setQuickAddOpen(false);
                  setQuickTitle("");
                }}
                className="cursor-pointer rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickTitle.trim() || createTicket.isPending}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  quickTitle.trim()
                    ? "bg-stone-800 text-white hover:bg-stone-900 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
                    : "bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500 cursor-not-allowed",
                )}
              >
                {createTicket.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 w-full rounded-lg px-3 py-2 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/40 transition-colors"
          >
            <FiPlus size={12} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

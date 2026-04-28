import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { arrayMove } from "@dnd-kit/sortable";
import {
  useTickets,
  useMoveTicket,
  useDeleteTicket,
  useReorderTickets,
  useBulkDeleteTickets,
  useMergePr,
} from "@/api/hooks/useTickets";
import { useAgents } from "@/api/hooks/useAgents";
import { GithubReviewerConnectDialog } from "@/components/GithubReviewerConnectDialog";
import { useAuth } from "@/contexts/AuthContext";
import { BoardColumn } from "./BoardColumn";
import { TicketCard } from "./TicketCard";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { BulkActionsBar } from "./BulkActionsBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { KanbanBoardSkeleton } from "@/components/Skeleton";
import { getSocket } from "@/lib/socket";
import type { Ticket, TicketStatus } from "@/types";

const COLUMNS: { id: TicketStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-gray-400" },
  { id: "development", label: "Development", color: "bg-purple-400" },
  { id: "review", label: "Code Review", color: "bg-orange-400" },
  { id: "testing", label: "Testing", color: "bg-yellow-400" },
  { id: "staged", label: "Staged", color: "bg-teal-400" },
  { id: "done", label: "Done", color: "bg-green-400" },
];

export function KanbanBoard({ spaceId }: { spaceId: string }) {
  const { refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tickets = [], isLoading: ticketsLoading } = useTickets(spaceId);
  const { data: agents = [] } = useAgents(spaceId);
  const moveTicket = useMoveTicket();
  const deleteTicket = useDeleteTicket();
  const reorderTickets = useReorderTickets();
  const bulkDelete = useBulkDeleteTickets();
  const mergePr = useMergePr();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Review verdict prompt state
  const [reviewVerdictPrompt, setReviewVerdictPrompt] = useState<{
    ticketId: string;
    summary: string;
  } | null>(null);

  // Reviewer GitHub auth prompt state
  const [reviewerAuthPrompt, setReviewerAuthPrompt] = useState(false);

  // Merge PR prompt state (shown when moving to staged)
  const [mergePrPrompt, setMergePrPrompt] = useState<{
    ticketId: string;
    targetStatus: TicketStatus;
  } | null>(null);

  // Listen for review_verdict WebSocket events
  useEffect(() => {
    const socket = getSocket();
    const handleReviewVerdict = (payload: {
      ticketId: string;
      verdict: string;
      summary: string;
    }) => {
      if (payload.verdict === "request_changes") {
        setReviewVerdictPrompt({
          ticketId: payload.ticketId,
          summary: payload.summary,
        });
      }
    };
    socket.on("review_verdict", handleReviewVerdict);
    return () => {
      socket.off("review_verdict", handleReviewVerdict);
    };
  }, []);

  // Listen for reviewer_auth_required WebSocket events
  useEffect(() => {
    const socket = getSocket();
    const handleReviewerAuthRequired = () => {
      setReviewerAuthPrompt(true);
    };
    socket.on("reviewer_auth_required", handleReviewerAuthRequired);
    return () => {
      socket.off("reviewer_auth_required", handleReviewerAuthRequired);
    };
  }, []);

  // Handle ticket query param from email links
  useEffect(() => {
    const ticketParam = searchParams.get("ticket");
    if (ticketParam && tickets.length > 0) {
      const ticketExists = tickets.some((t) => t.id === ticketParam);
      if (ticketExists) {
        setSelectedTicketId(ticketParam);
      }
      // Clear the query param after processing
      searchParams.delete("ticket");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, tickets]);

  const selectionMode = selectedIds.size > 0;

  const selectedTicket = selectedTicketId
    ? (tickets.find((t) => t.id === selectedTicketId) ?? null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const ticketsByStatus = useMemo(() => {
    const grouped = COLUMNS.reduce<Record<TicketStatus, Ticket[]>>(
      (acc, col) => {
        acc[col.id] = tickets
          .filter((t) => t.status === col.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return acc;
      },
      {} as Record<TicketStatus, Ticket[]>,
    );
    return grouped;
  }, [tickets]);

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const overId = over.id as string;
    const isColumn = COLUMNS.some((c) => c.id === overId);

    if (isColumn) {
      const newStatus = overId as TicketStatus;
      if (ticket.status !== newStatus) {
        // If moving to staged and ticket has a PR, prompt to merge
        if (newStatus === "staged" && ticket.prUrl) {
          setMergePrPrompt({ ticketId, targetStatus: newStatus });
        } else {
          moveTicket.mutate({ ticketId, status: newStatus, spaceId });
        }
      }
      return;
    }

    const overTicket = tickets.find((t) => t.id === overId);
    if (!overTicket) return;

    if (ticket.status === overTicket.status) {
      const columnTickets = ticketsByStatus[ticket.status as TicketStatus];
      const oldIndex = columnTickets.findIndex((t) => t.id === ticketId);
      const newIndex = columnTickets.findIndex((t) => t.id === overId);

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(columnTickets, oldIndex, newIndex);
        reorderTickets.mutate({
          spaceId,
          status: ticket.status,
          ticketIds: reordered.map((t) => t.id),
        });
      }
    } else {
      moveTicket.mutate({
        ticketId,
        status: overTicket.status,
        spaceId,
      });
    }
  };

  const handleDelete = (ticketId: string) => {
    setSelectedTicketId(null);
    deleteTicket.mutate({ ticketId, spaceId });
  };

  const toggleSelect = useCallback((ticketId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)));
    }
  }, [tickets, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    bulkDelete.mutate(
      { spaceId, ticketIds: ids },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  }, [selectedIds, spaceId, bulkDelete]);

  if (ticketsLoading) {
    return <KanbanBoardSkeleton />;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 p-3 md:gap-4 md:p-6 h-full overflow-x-auto">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              tickets={ticketsByStatus[col.id] || []}
              spaceId={spaceId}
              onTicketClick={(t) => {
                if (selectionMode) {
                  toggleSelect(t.id);
                } else {
                  setSelectedTicketId(t.id);
                }
              }}
              activeTicketId={activeTicket?.id ?? null}
              agents={agents}
              onDelete={handleDelete}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={tickets.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDelete.isPending}
      />

      {selectedTicket && !selectionMode && (
        <TicketDetailPanel
          ticket={selectedTicket}
          spaceId={spaceId}
          onClose={() => setSelectedTicketId(null)}
          onDelete={handleDelete}
        />
      )}

      {/* Review verdict prompt — reviewer requested changes */}
      <ConfirmDialog
        open={!!reviewVerdictPrompt}
        title="Code review: changes requested"
        message={
          reviewVerdictPrompt
            ? `The reviewer requested changes: "${reviewVerdictPrompt.summary}". Send the ticket back to the developer for fixing?`
            : ""
        }
        confirmLabel="Send to developer"
        cancelLabel="Leave as is"
        onConfirm={() => {
          if (reviewVerdictPrompt) {
            moveTicket.mutate({
              ticketId: reviewVerdictPrompt.ticketId,
              status: "development",
              spaceId,
            });
          }
          setReviewVerdictPrompt(null);
        }}
        onCancel={() => setReviewVerdictPrompt(null)}
      />

      {/* Merge PR prompt — shown when moving to staged */}
      <ConfirmDialog
        open={!!mergePrPrompt}
        title="Merge pull request?"
        message="This ticket has an open PR. Would you like to merge it before moving to staged?"
        confirmLabel="Merge & move"
        cancelLabel="Move without merging"
        onConfirm={() => {
          if (mergePrPrompt) {
            mergePr.mutate(
              { ticketId: mergePrPrompt.ticketId, spaceId },
              {
                onSuccess: () => {
                  moveTicket.mutate({
                    ticketId: mergePrPrompt.ticketId,
                    status: mergePrPrompt.targetStatus,
                    spaceId,
                  });
                },
                onError: () => {
                  // Still move even if merge fails — user was notified via toast
                  moveTicket.mutate({
                    ticketId: mergePrPrompt.ticketId,
                    status: mergePrPrompt.targetStatus,
                    spaceId,
                  });
                },
              },
            );
          }
          setMergePrPrompt(null);
        }}
        onCancel={() => {
          if (mergePrPrompt) {
            moveTicket.mutate({
              ticketId: mergePrPrompt.ticketId,
              status: mergePrPrompt.targetStatus,
              spaceId,
            });
          }
          setMergePrPrompt(null);
        }}
      />

      {/* Reviewer GitHub auth prompt — reviewer app not yet authorized */}
      <GithubReviewerConnectDialog
        open={reviewerAuthPrompt}
        onOpenChange={setReviewerAuthPrompt}
        onConnected={() => void refreshUser()}
        message="The code reviewer needs access to post PR reviews as a separate identity. Connect the Runa Reviewer GitHub app to enable APPROVE and REQUEST_CHANGES on pull requests."
      />
    </>
  );
}

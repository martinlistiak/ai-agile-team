import { useState, useEffect, useCallback } from "react";
import { FiArrowRight, FiZap, FiX } from "react-icons/fi";
import { useAdvanceTicket, useRunPipeline } from "@/api/hooks/usePipeline";
import { getSocket } from "@/lib/socket";

interface PipelineCompletedPayload {
  ticketId: string;
  completedStage: string;
  nextStage: string | null;
  agentType: string;
}

interface PipelinePromptProps {
  ticketId: string;
  spaceId: string;
}

/**
 * Banner shown inside TicketDetailModal when a pipeline_completed event fires
 * for the current ticket. Offers "Advance to next stage" and "Run full pipeline".
 */
export function PipelinePrompt({ ticketId, spaceId }: PipelinePromptProps) {
  const [event, setEvent] = useState<PipelineCompletedPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const advanceTicket = useAdvanceTicket();
  const runPipeline = useRunPipeline();

  useEffect(() => {
    const socket = getSocket();

    const handlePipelineCompleted = (payload: PipelineCompletedPayload) => {
      if (payload.ticketId === ticketId) {
        setEvent(payload);
        setDismissed(false);
      }
    };

    socket.on("pipeline_completed", handlePipelineCompleted);
    return () => {
      socket.off("pipeline_completed", handlePipelineCompleted);
    };
  }, [ticketId]);

  const handleAdvance = useCallback(() => {
    advanceTicket.mutate(
      { ticketId, spaceId },
      { onSuccess: () => setDismissed(true) },
    );
  }, [ticketId, spaceId, advanceTicket]);

  const handleRunFull = useCallback(() => {
    runPipeline.mutate(
      { ticketId, spaceId },
      { onSuccess: () => setDismissed(true) },
    );
  }, [ticketId, spaceId, runPipeline]);

  if (!event || dismissed) return null;

  const isPending = advanceTicket.isPending || runPipeline.isPending;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Pipeline stage completed
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            The {event.agentType} agent finished the{" "}
            <span className="font-medium">{event.completedStage}</span> stage.
            {event.nextStage ? ` Next: ${event.nextStage}` : " No more stages."}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="cursor-pointer p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800"
          title="Dismiss"
        >
          <FiX className="text-blue-500 dark:text-blue-400" size={14} />
        </button>
      </div>

      {event.nextStage && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleAdvance}
            disabled={isPending}
            className="cursor-pointer flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <FiArrowRight size={12} />
            {advanceTicket.isPending ? "Advancing…" : "Advance to next stage"}
          </button>
          <button
            onClick={handleRunFull}
            disabled={isPending}
            className="cursor-pointer flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <FiZap size={12} />
            {runPipeline.isPending ? "Running…" : "Run full pipeline"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Toast notification for the board view when pipeline_completed fires.
 * Renders a floating toast in the bottom-right corner.
 */
export function PipelineToast({ spaceId }: { spaceId: string }) {
  const [toasts, setToasts] = useState<PipelineCompletedPayload[]>([]);
  const advanceTicket = useAdvanceTicket();
  const runPipeline = useRunPipeline();

  useEffect(() => {
    const socket = getSocket();

    const handlePipelineCompleted = (payload: PipelineCompletedPayload) => {
      setToasts((prev) => [...prev, payload]);
    };

    socket.on("pipeline_completed", handlePipelineCompleted);
    return () => {
      socket.off("pipeline_completed", handlePipelineCompleted);
    };
  }, []);

  const dismissToast = (ticketId: string) => {
    setToasts((prev) => prev.filter((t) => t.ticketId !== ticketId));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.ticketId}
          className="rounded-lg border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-800 shadow-lg p-3 animate-in slide-in-from-right"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Pipeline stage completed
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {toast.agentType} finished{" "}
                <span className="font-medium">{toast.completedStage}</span>
                {toast.nextStage ? ` → ${toast.nextStage}` : ""}
              </p>
            </div>
            <button
              onClick={() => dismissToast(toast.ticketId)}
              className="cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FiX className="text-gray-400" size={14} />
            </button>
          </div>

          {toast.nextStage && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  advanceTicket.mutate(
                    { ticketId: toast.ticketId, spaceId },
                    { onSuccess: () => dismissToast(toast.ticketId) },
                  );
                }}
                disabled={advanceTicket.isPending}
                className="cursor-pointer flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
              >
                <FiArrowRight size={10} />
                Advance
              </button>
              <button
                onClick={() => {
                  runPipeline.mutate(
                    { ticketId: toast.ticketId, spaceId },
                    { onSuccess: () => dismissToast(toast.ticketId) },
                  );
                }}
                disabled={runPipeline.isPending}
                className="cursor-pointer flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
              >
                <FiZap size={10} />
                Full pipeline
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiZap, FiBook, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  useSpace,
  useUpdateSpace,
  useDeleteSpace,
} from "@/api/hooks/useSpaces";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { KanbanBoard } from "./KanbanBoard";
import { AuditToolbar } from "./AuditToolbar";
import { ChatBubble } from "@/features/chat/ChatBubble";
import { ChatModal } from "@/features/chat/ChatModal";
import { PipelineSettings } from "@/features/pipeline/PipelineSettings";
import { RulesPanel } from "@/features/rules/RulesPanel";
import { SuggestedRulesBar } from "@/features/rules/SuggestedRulesBar";
import { PipelineToast } from "@/components/PipelinePrompt";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { getSpaceColor, COLOR_PALETTE } from "@/lib/spaceColor";
import { cn } from "@/lib/cn";
import { formControlClassName } from "@/lib/formControlStyles";
import {
  overlaySurfaceClass,
  overlayBorderClass,
} from "@/components/overlaySurface";

export function BoardPage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { data: space } = useSpace(spaceId || null);
  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const [showPipeline, setShowPipeline] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEdit) return;
    const handleClick = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setShowEdit(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEdit]);

  const openEdit = () => {
    setEditName(space?.name || "");
    setEditColor(space?.color || null);
    setConfirmDelete(false);
    setShowEdit(true);
  };

  const saveEdit = () => {
    if (!spaceId) return;
    const payload: Record<string, unknown> = { id: spaceId };
    if (editName && editName !== space?.name) payload.name = editName;
    if (editColor !== (space?.color || null)) payload.color = editColor;
    if (Object.keys(payload).length > 1)
      updateSpace.mutate(payload as { id: string } & Record<string, unknown>);
    setShowEdit(false);
  };

  const handleDelete = () => {
    if (!spaceId) return;
    deleteSpace.mutate(spaceId, {
      onSuccess: () => {
        setShowEdit(false);
        navigate("/spaces");
      },
    });
  };

  // Subscribe to real-time events for this space
  useSocketEvents(spaceId || null);

  if (!spaceId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Select a space to get started</p>
      </div>
    );
  }

  const spaceColor = space ? getSpaceColor(space.name, space.color) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex items-center gap-2 md:gap-3 min-w-0">
            {/* Space color marker — a small vertical accent */}
            {spaceColor && (
              <span
                className="inline-block h-5 w-1 rounded-full shrink-0"
                style={{ backgroundColor: spaceColor }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-base md:text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 truncate">
              {space?.name || "Loading..."}
            </h1>
            {space && (
              <button
                type="button"
                onClick={openEdit}
                className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-md text-gray-350 transition-all duration-150 hover:text-gray-600 active:scale-90 dark:text-gray-500 dark:hover:text-gray-300 shrink-0"
                aria-label="Edit space"
                title="Edit space"
              >
                <FiEdit2 size={13} />
              </button>
            )}
            {space?.githubRepoUrl && (
              <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500 hidden md:inline">
                {space.githubRepoUrl}
              </span>
            )}
            {space?.gitlabRepoUrl && (
              <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500 hidden md:inline">
                {space.gitlabRepoUrl}
              </span>
            )}

            {showEdit && (
              <div
                ref={editRef}
                className={cn(
                  "absolute left-0 top-full z-40 mt-2 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-lg border shadow-lg dark:shadow-none animate-fade-in",
                  overlaySurfaceClass,
                  overlayBorderClass,
                )}
              >
                {/* Color band preview — matches modal accent bar without a second surface */}
                <div
                  className="h-2 w-full border-b border-stone-200/80 dark:border-stone-800 transition-colors duration-200"
                  style={{
                    backgroundColor:
                      editColor || getSpaceColor(editName, space?.color),
                  }}
                />

                <div className="p-5">
                  {/* Name field */}
                  <div className="mb-5">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                      }}
                      className={formControlClassName(
                        "w-full px-3 py-2 text-sm font-medium",
                      )}
                      placeholder="Space name"
                      autoFocus
                    />
                  </div>

                  {/* Color picker */}
                  <div className="mb-5">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PALETTE.map((c) => {
                        const isSelected =
                          (editColor ||
                            getSpaceColor(editName, space?.color)) === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className="cursor-pointer relative h-7 w-7 rounded-full transition-all duration-150 hover:scale-110"
                            style={{ backgroundColor: c }}
                            aria-label={`Set color to ${c}`}
                          >
                            {isSelected && (
                              <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                className="absolute inset-0 m-auto h-3.5 w-3.5"
                              >
                                <path
                                  d="M4 8l3 3 5-6"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    {/* Delete — danger zone, tucked left */}
                    <div>
                      {!confirmDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="cursor-pointer flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-stone-500 dark:hover:bg-red-950/35 dark:hover:text-red-400"
                        >
                          <FiTrash2 size={12} />
                          Delete
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-700"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Save / Cancel — right side */}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowEdit(false)}
                        className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="cursor-pointer rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.97]"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
            {/* Secondary actions — hidden labels on mobile */}
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="group/btn cursor-pointer flex items-center gap-1.5 rounded-lg px-2 py-1.5 md:px-3 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100/80 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-gray-800/60"
              aria-label="Rules"
            >
              <FiBook
                size={13}
                className="transition-transform duration-150 group-hover/btn:rotate-[-4deg]"
              />
              <span className="hidden md:inline">Rules</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPipeline(true)}
              className="group/btn cursor-pointer flex items-center gap-1.5 rounded-lg px-2 py-1.5 md:px-3 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100/80 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-gray-800/60"
              aria-label="Pipeline"
            >
              <FiZap
                size={13}
                className="transition-transform duration-150 group-hover/btn:-translate-y-px"
              />
              <span className="hidden md:inline">Pipeline</span>
            </button>

            {/* Divider */}
            <span
              className="mx-0.5 md:mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />

            {/* Primary action — uses space color for identity */}
            <button
              type="button"
              onClick={() => setShowCreateTicket(true)}
              className="cursor-pointer flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 md:px-3.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.96]"
              style={{
                backgroundColor: spaceColor || "#2c5282",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
              aria-label="New ticket"
            >
              <FiPlus size={13} strokeWidth={2.5} />
              <span className="hidden sm:inline">New ticket</span>
            </button>
          </div>
        </div>
      </div>

      <SuggestedRulesBar spaceId={spaceId} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <KanbanBoard spaceId={spaceId} />
        </div>
        <AuditToolbar spaceId={spaceId} />
      </div>

      {showPipeline && (
        <PipelineSettings
          spaceId={spaceId}
          onClose={() => setShowPipeline(false)}
        />
      )}
      {showRules && (
        <RulesPanel spaceId={spaceId} onClose={() => setShowRules(false)} />
      )}
      <PipelineToast spaceId={spaceId} />
      {showCreateTicket && (
        <TicketDetailPanel
          spaceId={spaceId}
          onClose={() => setShowCreateTicket(false)}
          onCreate={() => setShowCreateTicket(false)}
        />
      )}
      <ChatBubble />
      <ChatModal />
    </div>
  );
}

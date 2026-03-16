import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiZap, FiBook, FiPlus, FiEdit2, FiTrash2, FiCpu } from "react-icons/fi";
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
import { CustomAgentsPanel } from "@/features/agents/CustomAgentsPanel";
import { SuggestedRulesBar } from "@/features/rules/SuggestedRulesBar";
import { PipelineToast } from "@/components/PipelinePrompt";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { getSpaceColor, COLOR_PALETTE } from "@/lib/spaceColor";

export function BoardPage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { data: space } = useSpace(spaceId || null);
  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const [showPipeline, setShowPipeline] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
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
        navigate("/");
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
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="relative flex items-center gap-3">
            {/* Space color marker — a small vertical accent */}
            {spaceColor && (
              <span
                className="inline-block h-5 w-1 rounded-full"
                style={{ backgroundColor: spaceColor }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {space?.name || "Loading..."}
            </h1>
            {space && (
              <button
                type="button"
                onClick={openEdit}
                className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-md text-gray-350 transition-all duration-150 hover:text-gray-600 active:scale-90 dark:text-gray-500 dark:hover:text-gray-300"
                aria-label="Edit space"
                title="Edit space"
              >
                <FiEdit2 size={13} />
              </button>
            )}
            {space?.githubRepoUrl && (
              <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                {space.githubRepoUrl}
              </span>
            )}
            {space?.gitlabRepoUrl && (
              <span className="ml-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                {space.gitlabRepoUrl}
              </span>
            )}

            {showEdit && (
              <div
                ref={editRef}
                className="absolute left-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)] dark:border-gray-700/60 dark:bg-gray-850 dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5)]"
                style={{ animation: "fade-in 0.15s ease-out" }}
              >
                {/* Color band preview */}
                <div
                  className="h-2 w-full transition-colors duration-200"
                  style={{
                    backgroundColor:
                      editColor || getSpaceColor(editName, space?.color),
                  }}
                />

                <div className="p-5">
                  {/* Name field */}
                  <div className="mb-5">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-750"
                      placeholder="Space name"
                      autoFocus
                    />
                  </div>

                  {/* Color picker */}
                  <div className="mb-5">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
                          className="cursor-pointer flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
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
                            className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                        className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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
          <div className="flex items-center gap-1.5">
            {/* Secondary actions — quiet, tinted to space color on hover */}
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="group/btn cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100/80 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-gray-800/60"
            >
              <FiBook
                size={13}
                className="transition-transform duration-150 group-hover/btn:rotate-[-4deg]"
              />
              Rules
            </button>
            <button
              type="button"
              onClick={() => setShowAgents(true)}
              className="group/btn cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100/80 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-gray-800/60"
            >
              <FiCpu
                size={13}
                className="transition-transform duration-150 group-hover/btn:scale-110"
              />
              Agents
            </button>
            <button
              type="button"
              onClick={() => setShowPipeline(true)}
              className="group/btn cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-all duration-150 hover:bg-gray-100/80 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-gray-800/60"
            >
              <FiZap
                size={13}
                className="transition-transform duration-150 group-hover/btn:-translate-y-px"
              />
              Pipeline
            </button>

            {/* Divider */}
            <span
              className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />

            {/* Primary action — uses space color for identity */}
            <button
              type="button"
              onClick={() => setShowCreateTicket(true)}
              className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.96]"
              style={{
                backgroundColor: spaceColor || "#2c5282",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
            >
              <FiPlus size={13} strokeWidth={2.5} />
              New ticket
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
      {showAgents && (
        <CustomAgentsPanel
          spaceId={spaceId}
          onClose={() => setShowAgents(false)}
        />
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

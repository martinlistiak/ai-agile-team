import { useState } from "react";
import { FiPlus, FiTrash2, FiEdit2, FiX } from "react-icons/fi";
import {
  useAgents,
  useCreateCustomAgent,
  useUpdateCustomAgent,
  useDeleteCustomAgent,
} from "@/api/hooks/useAgents";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { formControlClassName } from "@/lib/formControlStyles";
import { getAvatarSrc } from "@/lib/avatars";
import type { Agent } from "@/types";

interface CustomAgentsPanelProps {
  spaceId: string;
  onClose: () => void;
}

interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  description: "",
  systemPrompt: "",
};

function AgentForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  data: AgentFormData;
  onChange: (data: AgentFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Name
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="e.g. Security Auditor"
          className={formControlClassName("w-full px-3 py-2 text-sm")}
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Description
        </label>
        <input
          type="text"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Short description of what this agent does"
          className={formControlClassName("w-full px-3 py-2 text-sm")}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Instructions / System Prompt
        </label>
        <textarea
          value={data.systemPrompt}
          onChange={(e) => onChange({ ...data, systemPrompt: e.target.value })}
          placeholder="Define the agent's behavior, role, and instructions..."
          rows={6}
          className={formControlClassName("w-full resize-none px-3 py-2 text-sm")}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!data.name.trim() || isPending}
          className={cn(
            "cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all",
            "bg-primary-600 hover:bg-primary-700 active:scale-[0.97]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onEdit,
  onDelete,
  isDeleting,
}: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src={getAvatarSrc("custom")}
            alt={agent.name || "Custom agent"}
            className="h-9 w-9 rounded-full pixelated"
          />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {agent.name || "Unnamed Agent"}
            </h4>
            {agent.description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {agent.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Edit agent"
          >
            <FiEdit2 size={13} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
                disabled={isDeleting}
                className="cursor-pointer rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              aria-label="Delete agent"
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {agent.systemPrompt && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Instructions
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
            {agent.systemPrompt}
          </p>
        </div>
      )}
    </div>
  );
}

export function CustomAgentsPanel({
  spaceId,
  onClose,
}: CustomAgentsPanelProps) {
  const { data: agents = [] } = useAgents(spaceId);
  const createAgent = useCreateCustomAgent(spaceId);
  const updateAgent = useUpdateCustomAgent(spaceId);
  const deleteAgent = useDeleteCustomAgent(spaceId);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [formData, setFormData] = useState<AgentFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const customAgents = agents.filter((a) => a.isCustom);

  const handleCreate = () => {
    createAgent.mutate(
      {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        systemPrompt: formData.systemPrompt.trim() || undefined,
      },
      {
        onSuccess: () => {
          setFormData(EMPTY_FORM);
          setMode("list");
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateAgent.mutate(
      {
        id: editingId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        systemPrompt: formData.systemPrompt.trim() || undefined,
      },
      {
        onSuccess: () => {
          setFormData(EMPTY_FORM);
          setEditingId(null);
          setMode("list");
        },
      },
    );
  };

  const handleEdit = (agent: Agent) => {
    setFormData({
      name: agent.name || "",
      description: agent.description || "",
      systemPrompt: agent.systemPrompt || "",
    });
    setEditingId(agent.id);
    setMode("edit");
  };

  const handleDelete = (agentId: string) => {
    deleteAgent.mutate(agentId);
  };

  return (
    <Modal
      onClose={onClose}
      aria-labelledby="custom-agents-title"
      className="relative w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 cursor-pointer rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        aria-label="Close"
      >
        <FiX size={18} />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2
          id="custom-agents-title"
          className="mb-4 pr-10 text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          Custom Agents
        </h2>
        {mode === "list" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create custom agents with predefined instructions to extend your
                team with specialized roles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormData(EMPTY_FORM);
                setMode("create");
              }}
              className="mb-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-xs font-medium text-gray-500 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50/70 hover:text-primary-700 dark:border-stone-600 dark:text-stone-400 dark:hover:border-primary-300/90 dark:hover:bg-stone-800/90 dark:hover:text-stone-100"
            >
              <FiPlus size={14} />
              Create new agent
            </button>

            {customAgents.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No custom agents yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {customAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => handleEdit(agent)}
                    onDelete={() => handleDelete(agent.id)}
                    isDeleting={deleteAgent.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {mode === "create" && (
          <>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Create Custom Agent
            </h3>
            <AgentForm
              data={formData}
              onChange={setFormData}
              onSubmit={handleCreate}
              onCancel={() => setMode("list")}
              submitLabel="Create Agent"
              isPending={createAgent.isPending}
            />
          </>
        )}

        {mode === "edit" && (
          <>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Edit Custom Agent
            </h3>
            <AgentForm
              data={formData}
              onChange={setFormData}
              onSubmit={handleUpdate}
              onCancel={() => {
                setEditingId(null);
                setMode("list");
              }}
              submitLabel="Save Changes"
              isPending={updateAgent.isPending}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

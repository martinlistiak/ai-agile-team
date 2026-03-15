import { useState } from "react";
import { FiX } from "react-icons/fi";
import { useCreateTicket } from "@/api/hooks/useTickets";
import type { Priority } from "@/types";

interface CreateTicketModalProps {
  spaceId: string;
  onClose: () => void;
}

export function CreateTicketModal({
  spaceId,
  onClose,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const createTicket = useCreateTicket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTicket.mutate(
      { spaceId, title: title.trim(), description, priority },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Create ticket"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            New Ticket
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <FiX size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ticket-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              id="ticket-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="ticket-desc"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="ticket-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add details..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="ticket-priority"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Priority
            </label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createTicket.isPending}
              className="cursor-pointer rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTicket.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

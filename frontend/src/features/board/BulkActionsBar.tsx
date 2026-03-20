import { useState } from "react";
import { FiTrash2, FiX, FiCheckSquare } from "react-icons/fi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/cn";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  isDeleting: boolean;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  isDeleting,
}: BulkActionsBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

        <button
          type="button"
          onClick={onSelectAll}
          className="cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <FiCheckSquare size={14} />
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isDeleting}
          className={cn(
            "cursor-pointer flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors",
            isDeleting
              ? "bg-red-300 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600",
          )}
        >
          <FiTrash2 size={14} />
          {isDeleting ? "Deleting…" : "Delete"}
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
          className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <FiX size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Delete selected tickets"
        message={`Are you sure you want to delete ${selectedCount} ticket${selectedCount === 1 ? "" : "s"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          setShowConfirm(false);
          onBulkDelete();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

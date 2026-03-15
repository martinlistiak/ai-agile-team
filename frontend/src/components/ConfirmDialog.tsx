import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <h3
          id="confirm-dialog-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {message}
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              isDanger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-primary-500 hover:bg-primary-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

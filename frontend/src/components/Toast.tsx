import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiX, FiAlertTriangle, FiInfo } from "react-icons/fi";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  /** In-app link (plain anchor — Toast mounts outside the router). */
  action?: { label: string; href: string };
}

interface ToastContextValue {
  toast: (
    type: ToastType,
    message: string,
    duration?: number,
    action?: { label: string; href: string },
  ) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  /** Starter daily agent run cap — long info toast with billing CTA. */
  agentRunLimit: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalId = 0;

const ICON_MAP: Record<ToastType, React.ReactNode> = {
  success: <FiCheck size={16} />,
  error: <FiX size={16} />,
  warning: <FiAlertTriangle size={16} />,
  info: <FiInfo size={16} />,
};

const STYLE_MAP: Record<ToastType, string> = {
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200",
  warning:
    "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

const ICON_BG_MAP: Record<ToastType, string> = {
  success: "bg-green-100 dark:bg-green-800/60",
  error: "bg-red-100 dark:bg-red-800/60",
  warning: "bg-yellow-100 dark:bg-yellow-800/60",
  info: "bg-blue-100 dark:bg-blue-800/60",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const fadeTimer = setTimeout(() => setExiting(true), duration - 300);
    const removeTimer = setTimeout(() => onDismiss(toast.id), duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg transition-all duration-300",
        toast.action ? "max-w-md" : "max-w-sm",
        STYLE_MAP[toast.type],
        exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          ICON_BG_MAP[toast.type],
        )}
      >
        {ICON_MAP[toast.type]}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium leading-5">{toast.message}</p>
        {toast.action ? (
          <a
            href={toast.action.href}
            className="inline-flex w-fit rounded-md bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {toast.action.label}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="cursor-pointer shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      type: ToastType,
      message: string,
      duration?: number,
      action?: { label: string; href: string },
    ) => {
      const id = `toast-${++globalId}`;
      setToasts((prev) => [
        ...prev.slice(-4),
        { id, type, message, duration, action },
      ]);
    },
    [],
  );

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string) => addToast("success", msg), [addToast]),
    error: useCallback(
      (msg: string) => addToast("error", msg, 6000),
      [addToast],
    ),
    warning: useCallback(
      (msg: string) => addToast("warning", msg, 5000),
      [addToast],
    ),
    info: useCallback((msg: string) => addToast("info", msg), [addToast]),
    agentRunLimit: useCallback(
      (msg: string) =>
        addToast("info", msg, 16_000, {
          label: "Upgrade to Team",
          href: "/billing",
        }),
      [addToast],
    ),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-9999 flex flex-col gap-2 max-w-sm"
            aria-live="polite"
            role="status"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

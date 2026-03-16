import { useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  overlaySurfaceClass,
  overlayBorderClass,
  overlayBackdropClass,
} from "./overlaySurface";

export interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Optional. Set to false to disable closing on backdrop click. */
  closeOnBackdropClick?: boolean;
  /** Class name for the inner panel (e.g. max-w, rounded). */
  className?: string;
  /** For accessibility. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

export function Modal({
  onClose,
  children,
  closeOnBackdropClick = true,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (closeOnBackdropClick) onClose();
  };

  return (
    <div
      className={cn(overlayBackdropClass, "fixed inset-0 z-50 flex items-center justify-center")}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          overlaySurfaceClass,
          overlayBorderClass,
          "flex flex-col rounded-lg border shadow-lg dark:shadow-none",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

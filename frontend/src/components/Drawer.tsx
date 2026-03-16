import { cn } from "@/lib/cn";
import {
  overlaySurfaceClass,
  overlayBorderClass,
  overlayBackdropClass,
} from "./overlaySurface";

export interface DrawerProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Which side the drawer slides from. */
  side?: "left" | "right";
  /** Class name for the panel (e.g. max-w). */
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

export function Drawer({
  onClose,
  children,
  side = "right",
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: DrawerProps) {
  return (
    <>
      <div
        className={cn(overlayBackdropClass, "fixed inset-0 z-40")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          overlaySurfaceClass,
          overlayBorderClass,
          "fixed inset-y-0 z-50 flex w-full flex-col shadow-[-8px_0_32px_rgba(28,25,23,0.08)] dark:shadow-[-8px_0_32px_rgba(0,0,0,0.3)]",
          side === "left" && "left-0 border-r border-stone-200 dark:border-stone-800",
          side === "right" && "right-0 border-l border-stone-200 dark:border-stone-800",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </>
  );
}

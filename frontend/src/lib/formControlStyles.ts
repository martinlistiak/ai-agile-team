import { cn } from "@/lib/cn";

/**
 * Text inputs and textareas: stone surfaces, light focus lift, dark focus stays in-family
 * (no white flash) with a slightly brighter border and subtle keyboard ring.
 */
export function formControlClassName(extra?: string) {
  return cn(
    "rounded-lg border outline-none transition-colors duration-150",
    "border-stone-200 bg-stone-50/80 text-stone-900 placeholder:text-stone-400",
    "focus:border-primary-500 focus:bg-white",
    "focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50",
    "dark:border-stone-600 dark:bg-stone-900/70 dark:text-stone-100 dark:placeholder:text-stone-500",
    "dark:focus:border-stone-400 dark:focus:bg-stone-950",
    "dark:focus-visible:ring-stone-400/40 dark:focus-visible:ring-offset-stone-900",
    extra,
  );
}

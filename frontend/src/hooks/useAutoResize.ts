import { useCallback, useRef, type RefObject } from "react";

const MAX_HEIGHT = 200; // ~10 lines

/**
 * Returns a ref and an onChange handler that auto-expands a textarea
 * line-by-line up to MAX_HEIGHT, then scrolls.
 */
export function useAutoResize(): [
  RefObject<HTMLTextAreaElement | null>,
  (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
] {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  return [ref, resize];
}

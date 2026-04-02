import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";

const MENTIONABLE_AGENTS = [
  { id: "developer", label: "Developer", aliases: ["dev"] },
  { id: "pm", label: "PM", aliases: [] },
  { id: "tester", label: "Tester", aliases: [] },
  { id: "reviewer", label: "Reviewer", aliases: [] },
];

const MENTION_PATTERN = /@(developer|dev|pm|tester|reviewer)\b/gi;

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Write a comment...",
  disabled = false,
  className,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState(MENTIONABLE_AGENTS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Render content with highlighted mentions
  const renderContent = useCallback((text: string) => {
    if (!text) return "";

    MENTION_PATTERN.lastIndex = 0;
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MENTION_PATTERN.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        result += escapeHtml(text.slice(lastIndex, match.index));
      }

      // Normalize agent name
      let agent = match[1].toLowerCase();
      if (agent === "dev") agent = "developer";

      // Add styled mention tag
      result +=
        `<span class="mention-tag" data-agent="${agent}" contenteditable="false">` +
        `<img src="${getAvatarSrc(agent)}" alt="" class="mention-avatar" />` +
        `@${agent}</span>`;

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result += escapeHtml(text.slice(lastIndex));
    }

    return result;
  }, []);

  // Sync editor content when value changes externally
  useEffect(() => {
    if (editorRef.current) {
      const currentText = getPlainText(editorRef.current);
      if (currentText !== value) {
        editorRef.current.innerHTML = renderContent(value) || `<br>`;
        // Move cursor to end
        moveCursorToEnd(editorRef.current);
      }
    }
  }, [value, renderContent]);

  const updatePopupPosition = useCallback(() => {
    if (editorRef.current) {
      const rect = editorRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.top - 8,
        left: rect.left,
      });
    }
  }, []);

  const checkForMention = useCallback(
    (text: string, cursorPos: number) => {
      // Look backwards from cursor for @ symbol
      let start = cursorPos - 1;
      while (start >= 0 && text[start] !== " " && text[start] !== "\n") {
        if (text[start] === "@") {
          const query = text.slice(start + 1, cursorPos).toLowerCase();
          const filtered = MENTIONABLE_AGENTS.filter(
            (agent) =>
              agent.id.toLowerCase().startsWith(query) ||
              agent.label.toLowerCase().startsWith(query) ||
              agent.aliases.some((a) => a.toLowerCase().startsWith(query)),
          );
          if (filtered.length > 0 || query === "") {
            setSuggestions(filtered.length > 0 ? filtered : MENTIONABLE_AGENTS);
            setShowSuggestions(true);
            setSelectedIndex(0);
            updatePopupPosition();
            return start;
          }
        }
        start--;
      }
      setShowSuggestions(false);
      return null;
    },
    [updatePopupPosition],
  );

  const handleInput = () => {
    if (!editorRef.current) return;

    const plainText = getPlainText(editorRef.current);
    onChange(plainText);

    // Check for mention trigger
    const cursorPos = getCursorPosition(editorRef.current);
    checkForMention(plainText, cursorPos);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const insertMention = (agent: (typeof MENTIONABLE_AGENTS)[0]) => {
    if (!editorRef.current) return;

    const plainText = getPlainText(editorRef.current);
    const cursorPos = getCursorPosition(editorRef.current);

    // Find the @ symbol position
    let start = cursorPos - 1;
    while (start >= 0 && plainText[start] !== "@") {
      start--;
    }

    if (start < 0) return;

    // Build new text with the mention
    const before = plainText.slice(0, start);
    const after = plainText.slice(cursorPos);
    const newText = `${before}@${agent.id} ${after}`;

    onChange(newText);
    setShowSuggestions(false);

    // Update editor and move cursor
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = renderContent(newText) || `<br>`;
        // Position cursor after the mention
        const newCursorPos = start + agent.id.length + 2;
        setCursorPosition(editorRef.current, newCursorPos);
        editorRef.current.focus();
      }
    }, 0);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const popupHeight = 44 + suggestions.length * 40;

  return (
    <div className={cn("relative", className)}>
      <style>{`
        .mention-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          margin: 0 1px;
          border-radius: 4px;
          background: rgb(237 233 254);
          color: rgb(109 40 217);
          font-size: 12px;
          font-weight: 500;
          line-height: inherit;
          vertical-align: middle;
          user-select: all;
        }
        .dark .mention-tag {
          background: rgb(91 33 182 / 0.3);
          color: rgb(196 181 253);
        }
        .mention-avatar {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          image-rendering: pixelated;
        }
        .mention-editor:empty:before {
          content: attr(data-placeholder);
          color: rgb(168 162 158);
          pointer-events: none;
        }
        .dark .mention-editor:empty:before {
          color: rgb(120 113 108);
        }
      `}</style>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "mention-editor",
          "w-full h-full min-h-[60px] resize-none bg-transparent border-none outline-none",
          "text-sm text-stone-800 dark:text-stone-200",
          "whitespace-pre-wrap break-words",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        style={{ wordBreak: "break-word" }}
      />

      {showSuggestions &&
        createPortal(
          <div
            ref={suggestionsRef}
            style={{
              position: "fixed",
              top: popupPosition.top - popupHeight,
              left: popupPosition.left,
              zIndex: 9999,
            }}
            className={cn(
              "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700",
              "rounded-lg shadow-xl py-1 min-w-[200px]",
            )}
          >
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-700">
              Mention an agent
            </div>
            {suggestions.map((agent, index) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => insertMention(agent)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  index === selectedIndex
                    ? "bg-stone-100 dark:bg-stone-700"
                    : "hover:bg-stone-50 dark:hover:bg-stone-700/50",
                )}
              >
                <img
                  src={getAvatarSrc(agent.id)}
                  alt=""
                  className="h-5 w-5 rounded-full pixelated"
                />
                <span className="text-stone-700 dark:text-stone-200">
                  @{agent.id}
                </span>
                <span className="text-stone-400 dark:text-stone-500 text-xs ml-auto">
                  {agent.label}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

// Helper functions
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function getPlainText(element: HTMLElement): string {
  let text = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === "BR") {
      text += "\n";
    } else if ((node as HTMLElement).classList?.contains("mention-tag")) {
      const agent = (node as HTMLElement).dataset.agent;
      text += `@${agent}`;
    } else {
      node.childNodes.forEach(walk);
    }
  };
  walk(element);
  return text;
}

function getCursorPosition(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);

  // Count characters including mention tags
  const tempDiv = document.createElement("div");
  tempDiv.appendChild(preRange.cloneContents());

  return getPlainText(tempDiv).length;
}

function setCursorPosition(element: HTMLElement, position: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  let currentPos = 0;
  const range = document.createRange();

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (currentPos + len >= position) {
        range.setStart(node, position - currentPos);
        range.collapse(true);
        return true;
      }
      currentPos += len;
    } else if ((node as HTMLElement).classList?.contains("mention-tag")) {
      const agent = (node as HTMLElement).dataset.agent;
      const len = (agent?.length || 0) + 1; // +1 for @
      if (currentPos + len >= position) {
        // Position after the mention tag
        range.setStartAfter(node);
        range.collapse(true);
        return true;
      }
      currentPos += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true;
      }
    }
    return false;
  };

  walk(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function moveCursorToEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

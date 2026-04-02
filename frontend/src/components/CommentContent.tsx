import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";

interface CommentContentProps {
  content: string;
  className?: string;
}

const MENTION_PATTERN = /@(developer|dev|pm|tester|reviewer)\b/gi;

/**
 * Renders comment content with highlighted @mentions.
 * Mentions are displayed as inline badges with agent avatars.
 */
export function CommentContent({ content, className }: CommentContentProps) {
  const parts: (string | { type: "mention"; agent: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_PATTERN.lastIndex = 0;

  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Normalize the agent name (dev -> developer)
    let agent = match[1].toLowerCase();
    if (agent === "dev") agent = "developer";

    parts.push({ type: "mention", agent });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return (
    <div
      className={cn(
        "text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap break-words overflow-wrap-anywhere",
        className,
      )}
      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
      {parts.map((part, i) => {
        if (typeof part === "string") {
          return <span key={i}>{part}</span>;
        }
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md",
              "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
              "font-medium text-xs align-middle",
            )}
          >
            <img
              src={getAvatarSrc(part.agent)}
              alt=""
              className="h-3.5 w-3.5 rounded-full pixelated"
            />
            @{part.agent}
          </span>
        );
      })}
    </div>
  );
}

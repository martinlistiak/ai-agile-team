import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { renderMarkdown } from "@/lib/markdown";
import { getAvatarSrc } from "@/lib/avatars";

interface CommentContentProps {
  content: string;
  className?: string;
}

const MENTION_PATTERN = /@(developer|dev|pm|tester|reviewer)\b/gi;

function normAgent(name: string) {
  return name.toLowerCase() === "dev" ? "developer" : name.toLowerCase();
}

/**
 * Renders comment content as markdown with highlighted @mentions.
 * Mentions are displayed as inline badges with agent avatars.
 */
export function CommentContent({ content, className }: CommentContentProps) {
  const html = useMemo(() => {
    // Render markdown first
    let rendered = renderMarkdown(content);

    // Replace @mentions in the rendered HTML with badge markup
    rendered = rendered.replace(MENTION_PATTERN, (_match, agent: string) => {
      const normalized = normAgent(agent);
      const avatar = getAvatarSrc(normalized);
      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium text-xs align-middle"><img src="${avatar}" alt="" class="h-3.5 w-3.5 rounded-full pixelated" />@${normalized}</span>`;
    });

    return rendered;
  }, [content]);

  return (
    <div
      className={cn(
        "text-sm text-stone-700 dark:text-stone-300 break-words",
        "prose prose-sm prose-stone dark:prose-invert max-w-none",
        "prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
        "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-strong:font-semibold prose-code:text-xs prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-stone-100 dark:prose-code:bg-stone-800",
        className,
      )}
      style={{ overflowWrap: "anywhere" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

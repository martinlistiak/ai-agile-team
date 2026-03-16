import { getAvatarSrc } from "@/lib/avatars";

const AGENT_LABEL: Record<string, string> = {
  pm: "PM",
  developer: "Dev",
  reviewer: "Review",
  tester: "Test",
};

export function TypingIndicator({ agentType }: { agentType: string }) {
  return (
    <div className="flex justify-start">
      <img
        src={getAvatarSrc(agentType)}
        alt={`${agentType} agent`}
        className="mr-2 mt-1 h-7 w-7 shrink-0 rounded-full pixelated"
      />
      <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {AGENT_LABEL[agentType] ?? "Agent"} is thinking
        </span>
        <div
          className="flex items-center gap-[3px]"
          aria-label="Agent is typing"
        >
          <span
            className="typing-dot h-[5px] w-[5px] rounded-full bg-gray-400 dark:bg-gray-500"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="typing-dot h-[5px] w-[5px] rounded-full bg-gray-400 dark:bg-gray-500"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="typing-dot h-[5px] w-[5px] rounded-full bg-gray-400 dark:bg-gray-500"
            style={{ animationDelay: "320ms" }}
          />
        </div>
      </div>
    </div>
  );
}

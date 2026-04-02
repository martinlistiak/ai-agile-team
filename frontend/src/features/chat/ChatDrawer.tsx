import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FiImage, FiSend, FiX, FiActivity } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { useAutoResize } from "@/hooks/useAutoResize";
import { renderMarkdown } from "@/lib/markdown";
import { useChatContext } from "@/contexts/ChatContext";
import { TypingIndicator } from "./TypingIndicator";
import { useChatMessages, useSendChatMessage } from "@/api/hooks/useChat";
import { useSpace } from "@/api/hooks/useSpaces";
import { useAgents } from "@/api/hooks/useAgents";
import { getSpaceColor } from "@/lib/spaceColor";
import { AgentRunLimitUpsell } from "@/components/AgentRunLimitUpsell";
import { AgentInspector } from "@/features/agents/AgentInspector";
import type { ChatAttachment, ChatMessage, Agent } from "@/types";
import api from "@/api/client";

function PersistedImageAttachment({
  attachment,
}: {
  attachment: ChatAttachment;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    api
      .get(attachment.url, { responseType: "blob" })
      .then(({ data }) => {
        if (!isActive) return;
        objectUrl = URL.createObjectURL(data);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        setImageUrl(null);
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment.url]);

  if (!imageUrl) {
    return (
      <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={attachment.fileName}
      className="max-h-56 w-full rounded-lg object-cover"
    />
  );
}

const AGENT_BADGE: Record<string, { label: string; color: string }> = {
  pm: {
    label: "PM",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  developer: {
    label: "Dev",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  reviewer: {
    label: "Review",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  tester: {
    label: "Test",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
};

const AGENT_NAMES: Record<string, string> = {
  pm: "PM Agent",
  developer: "Developer Agent",
  reviewer: "Reviewer Agent",
  tester: "Tester Agent",
};

function getAgentBadge(
  agentType: string,
): { label: string; color: string } | null {
  if (AGENT_BADGE[agentType]) return AGENT_BADGE[agentType];
  if (agentType.startsWith("custom:")) {
    return {
      label: "Custom",
      color:
        "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    };
  }
  return null;
}

function ChatBubble({
  message,
  spaceColor,
}: {
  message: ChatMessage;
  spaceColor?: string;
}) {
  const isUser = message.role === "user";
  const agentBadge =
    !isUser && message.agentType ? getAgentBadge(message.agentType) : null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && message.agentType && (
        <img
          src={getAvatarSrc(message.agentType)}
          alt={`${message.agentType} agent`}
          className="mr-2 mt-1 h-7 w-7 shrink-0 rounded-full pixelated"
        />
      )}
      <div
        className={cn(
          "max-w-[80%] space-y-2 rounded-2xl px-4 py-3 text-sm shadow-sm",
          !isUser &&
            "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
        )}
        style={
          isUser
            ? {
                backgroundColor: spaceColor || "#6366f1",
                color: "white",
              }
            : undefined
        }
      >
        {agentBadge && message.agentType && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
              agentBadge.color,
            )}
          >
            {agentBadge.label} Agent
          </span>
        )}
        {message.content && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none wrap-break-word"
            style={
              isUser
                ? {
                    color: "white",
                  }
                : {}
            }
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(message.content),
            }}
          />
        )}
        {message.attachments.length > 0 && (
          <div className="grid gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="overflow-hidden rounded-xl bg-white/10 p-1 dark:bg-black/10"
              >
                {attachment.isImage ? (
                  <PersistedImageAttachment attachment={attachment} />
                ) : (
                  <p className="text-xs">{attachment.fileName}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatDrawer() {
  const { spaceId } = useParams();
  const { isOpen, selectedAgent, closeChat, markRead } = useChatContext();
  const { data: messages = [], isLoading } = useChatMessages(
    isOpen ? spaceId || null : null,
    selectedAgent,
  );
  const { data: space } = useSpace(isOpen ? spaceId || null : null);
  const { data: agents = [] } = useAgents(spaceId || null);
  const spaceColor = space ? getSpaceColor(space.name, space.color) : undefined;
  const sendMessage = useSendChatMessage(spaceId || null);

  const [input, setInput] = useState("");
  const [textareaRef, handleTextareaResize] = useAutoResize();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<
    Array<{ file: File; url: string | null }>
  >([]);
  const [showInspector, setShowInspector] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const prevAgentRef = useRef(selectedAgent);

  const MIN_WIDTH = 320;
  const MAX_WIDTH = 720;

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 56 - 56; // Subtract SpaceSidebar (56px) and AgentPanel (56px) widths
      setDrawerWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Detect agent change and trigger animation
  useEffect(() => {
    if (selectedAgent !== prevAgentRef.current && isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      prevAgentRef.current = selectedAgent;
      return () => clearTimeout(timer);
    }
  }, [selectedAgent, isOpen]);

  useEffect(() => {
    if (isOpen) {
      markRead();
    }
  }, [isOpen, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setFilePreviews(previews);

    return () => {
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
  }, [selectedFiles]);

  // Get current agent object for inspector
  const currentAgentObj: Agent | null = (() => {
    if (selectedAgent.startsWith("custom:")) {
      const customId = selectedAgent.replace("custom:", "");
      return agents.find((a) => a.id === customId) || null;
    }
    return agents.find((a) => a.agentType === selectedAgent) || null;
  })();

  const agentDisplayName =
    AGENT_NAMES[selectedAgent] ||
    (selectedAgent.startsWith("custom:")
      ? currentAgentObj?.name || "Custom Agent"
      : "Agent");

  if (!isOpen || !spaceId) return null;

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || sendMessage.isPending)
      return;

    const messageText = input.trim();
    const files = [...selectedFiles];

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    sendMessage.mutate({
      message: messageText,
      files,
      agentType: selectedAgent,
    });
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setSelectedFiles((current) => [...current, ...files]);
  };

  const removeSelectedFile = (targetFile: File) => {
    setSelectedFiles((current) =>
      current.filter((file) => file !== targetFile),
    );
  };

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/60 shrink-0",
          "transition-opacity duration-300 ease-out",
          isAnimating && "animate-pulse-subtle",
          isResizing && "select-none",
        )}
        style={{ width: drawerWidth }}
      >
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
            "hover:bg-primary-400/50 active:bg-primary-500/50 transition-colors",
            isResizing && "bg-primary-500/50",
          )}
        />
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3 md:py-4 dark:border-stone-800">
          <div
            className={cn(
              "flex items-center gap-2 transition-all duration-300",
              isAnimating && "scale-105",
            )}
          >
            <img
              src={getAvatarSrc(
                selectedAgent.startsWith("custom:") ? "custom" : selectedAgent,
              )}
              alt={agentDisplayName}
              className={cn(
                "h-7 w-7 rounded-full pixelated transition-transform duration-300",
                isAnimating && "rotate-360",
              )}
            />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {agentDisplayName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {currentAgentObj && (
              <button
                type="button"
                onClick={() => setShowInspector(true)}
                className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="Inspect agent"
                title="Inspect agent"
              >
                <FiActivity className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={closeChat}
              className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              aria-label="Close chat"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 transition-opacity duration-200",
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Send a message to start chatting with {agentDisplayName}.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  spaceColor={spaceColor}
                />
              ))}
              {sendMessage.isPending && (
                <TypingIndicator agentType={selectedAgent} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-stone-200 px-4 py-3 dark:border-stone-800">
          <AgentRunLimitUpsell
            error={sendMessage.error}
            onDismiss={() => sendMessage.reset()}
            className="mb-3"
          />
          {filePreviews.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {filePreviews.map((preview) => (
                <div
                  key={`${preview.file.name}-${preview.file.lastModified}`}
                  className="relative shrink-0"
                >
                  {preview.url ? (
                    <img
                      src={preview.url}
                      alt={preview.file.name}
                      className="h-14 w-14 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700">
                      <span className="text-[10px] font-medium text-gray-500 uppercase">
                        {preview.file.name.split(".").pop()}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(preview.file)}
                    className="cursor-pointer absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white shadow-sm transition-colors hover:bg-red-500 dark:bg-gray-600"
                    aria-label={`Remove ${preview.file.name}`}
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-gray-100 text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-primary-500 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800"
              aria-label="Attach files"
            >
              <FiImage className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelection}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                handleTextareaResize(event);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="box-border w-full resize-none overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-300 focus:bg-white focus:ring-1 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600 dark:focus:bg-gray-800"
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={
                sendMessage.isPending ||
                (!input.trim() && selectedFiles.length === 0)
              }
              className={cn(
                "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-gray-300 transition-colors dark:text-gray-600",
                input.trim() || selectedFiles.length > 0
                  ? "border-primary-600/20 bg-primary-500 text-white shadow-sm hover:bg-primary-600 active:scale-[0.97]"
                  : "bg-gray-100 dark:bg-gray-800/80",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
              )}
              aria-label="Send message"
            >
              <FiSend className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Agent Inspector */}
      {showInspector && currentAgentObj && (
        <AgentInspector
          agent={currentAgentObj}
          onClose={() => setShowInspector(false)}
        />
      )}
    </>
  );
}

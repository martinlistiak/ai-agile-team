import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { FiImage, FiSend, FiX } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { useChatContext } from "@/contexts/ChatContext";
import { AgentSelectorDropdown } from "./AgentSelectorDropdown";
import { TypingIndicator } from "./TypingIndicator";
import { useChatMessages, useSendChatMessage } from "@/api/hooks/useChat";
import { Modal } from "@/components/Modal";
import { AgentRunLimitUpsell } from "@/components/AgentRunLimitUpsell";
import type { ChatAttachment, ChatMessage } from "@/types";
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

function ChatBubble({ message }: { message: ChatMessage }) {
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
          isUser
            ? "bg-primary-500 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
        )}
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
          <p className="whitespace-pre-wrap">{message.content}</p>
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

export function ChatModal() {
  const { spaceId } = useParams();
  const { isOpen, selectedAgent, openChat, closeChat, markRead } =
    useChatContext();
  const { data: messages = [], isLoading } = useChatMessages(
    isOpen ? spaceId || null : null,
    selectedAgent,
  );
  const sendMessage = useSendChatMessage(spaceId || null);

  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<
    Array<{ file: File; url: string | null }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen || !spaceId) return null;

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || sendMessage.isPending)
      return;

    const messageText = input.trim();
    const files = [...selectedFiles];

    setInput("");
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

  return createPortal(
    <Modal
      onClose={closeChat}
      className="mx-2 flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden md:mx-4 md:max-h-[80vh]"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <AgentSelectorDropdown
          value={selectedAgent}
          onChange={(agent) => openChat(agent)}
        />
        <button
          type="button"
          onClick={closeChat}
          className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label="Close chat"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      {/* Message list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Send a message or attach a screenshot to start chatting.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {sendMessage.isPending && (
              <TypingIndicator agentType={selectedAgent} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-stone-200 px-5 py-4 dark:border-stone-800">
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
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700">
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
            className="cursor-pointer flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-transparent bg-gray-100 text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-primary-500 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            aria-label="Attach files"
          >
            <FiImage className="h-[18px] w-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileSelection}
          />

          <div className="relative min-h-11 min-w-0 flex-1">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="box-border h-11 w-full resize-none overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-3 pt-3 pb-2 text-sm leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-300 focus:bg-white focus:ring-1 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600 dark:focus:bg-gray-800"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={
              sendMessage.isPending ||
              (!input.trim() && selectedFiles.length === 0)
            }
            className={cn(
              "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-gray-300 transition-colors dark:text-gray-600",
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
    </Modal>,
    document.body,
  );
}

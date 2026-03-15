import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FiImage, FiSend, FiX } from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatAttachment, ChatMessage } from "@/types";
import api from "@/api/client";
import {
  useChatMessages,
  useSendChatMessage,
  type AgentType,
} from "@/api/hooks/useChat";

const AGENT_OPTIONS: {
  value: AgentType;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: "pm",
    label: "PM",
    description: "Create & plan tickets",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  {
    value: "developer",
    label: "Dev",
    description: "Implement code",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  {
    value: "tester",
    label: "Test",
    description: "Write & run tests",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
];

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
  tester: {
    label: "Test",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
};

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const agentBadge =
    !isUser && message.agentType ? AGENT_BADGE[message.agentType] : null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-sm shadow-sm",
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
            <img
              src={getAvatarSrc(message.agentType)}
              alt={agentBadge.label}
              className="h-4 w-4 rounded-full pixelated"
            />
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

export function ChatPanel() {
  const { spaceId } = useParams();
  const { data: messages = [], isLoading } = useChatMessages(spaceId || null);
  const sendMessage = useSendChatMessage(spaceId || null);
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("pm");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    const previews = selectedImages.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImagePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedImages]);

  useEffect(() => {
    setSelectedImages([]);
    setInput("");
  }, [spaceId]);

  if (!spaceId) return null;

  const handleSend = () => {
    if ((!input.trim() && selectedImages.length === 0) || sendMessage.isPending)
      return;

    const messageText = input.trim();
    const images = [...selectedImages];

    setInput("");
    setSelectedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    sendMessage.mutate({
      message: messageText,
      images,
      agentType: selectedAgent,
    });
  };

  const currentAgent =
    AGENT_OPTIONS.find((a) => a.value === selectedAgent) || AGENT_OPTIONS[0];

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setSelectedImages((current) => [...current, ...files]);
  };

  const removeSelectedImage = (targetFile: File) => {
    setSelectedImages((current) =>
      current.filter((file) => file !== targetFile),
    );
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Chat with {currentAgent.label} Agent
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentAgent.description}
          </p>
        </div>
        <div className="flex gap-1">
          {AGENT_OPTIONS.map((agent) => (
            <button
              key={agent.value}
              type="button"
              onClick={() => setSelectedAgent(agent.value)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all",
                selectedAgent === agent.value
                  ? agent.color
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
              )}
            >
              {agent.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Send a message or attach a screenshot to the PM agent.
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

      <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800/60">
        {imagePreviews.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {imagePreviews.map((preview) => (
              <div
                key={`${preview.file.name}-${preview.file.lastModified}`}
                className="relative shrink-0"
              >
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedImage(preview.file)}
                  className="cursor-pointer absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white shadow-sm transition-colors hover:bg-red-500 dark:bg-gray-600"
                  aria-label={`Remove ${preview.file.name}`}
                >
                  <FiX className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-500 dark:hover:bg-gray-800 dark:text-gray-500"
            aria-label="Attach images"
          >
            <FiImage className="h-[18px] w-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelection}
          />

          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe a feature or attach a screenshot..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-300 focus:bg-white focus:ring-1 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600 dark:focus:bg-gray-800"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={
              sendMessage.isPending ||
              (!input.trim() && selectedImages.length === 0)
            }
            className={cn(
              "cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
              input.trim() || selectedImages.length > 0
                ? "bg-primary-500 text-white shadow-sm hover:bg-primary-600 active:scale-95"
                : "text-gray-300 dark:text-gray-600",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
            )}
            aria-label="Send message"
          >
            <FiSend className="h-[16px] w-[16px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

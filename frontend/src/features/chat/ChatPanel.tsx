import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  FiChevronDown,
  FiChevronRight,
  FiPaperclip,
  FiSend,
  FiX,
} from "react-icons/fi";
import { cn } from "@/lib/cn";
import { getAvatarSrc } from "@/lib/avatars";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatAttachment, ChatMessage, Ticket, Agent } from "@/types";
import api from "@/api/client";
import { useTickets } from "@/api/hooks/useTickets";
import { useAgents } from "@/api/hooks/useAgents";
import {
  useChatMessages,
  useSendChatMessage,
} from "@/api/hooks/useChat";
import { AgentRunLimitUpsell } from "@/components/AgentRunLimitUpsell";

interface AgentOption {
  value: string;
  label: string;
  description: string;
  color: string;
}

const BUILT_IN_AGENT_OPTIONS: AgentOption[] = [
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
    value: "reviewer",
    label: "Review",
    description: "Review code changes",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  {
    value: "tester",
    label: "Test",
    description: "Write & run tests",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
];

function buildAgentOptions(agents: Agent[]): AgentOption[] {
  const customAgents = agents
    .filter((a) => a.isCustom)
    .map((a) => ({
      value: `custom:${a.id}`,
      label: a.name || "Custom",
      description: a.description || "Custom agent",
      color:
        "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    }));
  return [...BUILT_IN_AGENT_OPTIONS, ...customAgents];
}

/* ── Persisted attachment viewer ── */

function PersistedAttachment({ attachment }: { attachment: ChatAttachment }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.isImage) return;
    let isActive = true;
    let objectUrl: string | null = null;

    api
      .get(attachment.url, { responseType: "blob" })
      .then(({ data }) => {
        if (!isActive) return;
        objectUrl = URL.createObjectURL(data);
        setImageUrl(objectUrl);
      })
      .catch(() => setImageUrl(null));

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.url, attachment.isImage]);

  if (attachment.isImage) {
    if (!imageUrl) {
      return (
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Loading image…
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

  // PDF or other file — show as a download link
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <FiPaperclip className="shrink-0" />
      <span className="truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-gray-400">
        {(attachment.byteSize / 1024).toFixed(0)} KB
      </span>
    </a>
  );
}

/* ── Interactive ticket accordion ── */

interface CreatedTicketInfo {
  ticketId: string;
  title: string;
}

function TicketAccordion({
  tickets: createdTickets,
  onTicketClick,
}: {
  tickets: CreatedTicketInfo[];
  onTicketClick: (ticketId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (createdTickets.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      >
        <span>
          {createdTickets.length} ticket{createdTickets.length !== 1 ? "s" : ""}{" "}
          created
        </span>
        {isOpen ? (
          <FiChevronDown className="h-3.5 w-3.5" />
        ) : (
          <FiChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {isOpen && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {createdTickets.map((t) => (
            <button
              key={t.ticketId}
              type="button"
              onClick={() => onTicketClick(t.ticketId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Chat bubble ── */

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

function getAgentBadge(agentType: string): { label: string; color: string } | null {
  if (AGENT_BADGE[agentType]) return AGENT_BADGE[agentType];
  if (agentType.startsWith("custom:")) {
    return {
      label: "Custom",
      color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    };
  }
  return null;
}

function ChatBubble({
  message,
  createdTickets,
  onTicketClick,
}: {
  message: ChatMessage;
  createdTickets?: CreatedTicketInfo[];
  onTicketClick: (ticketId: string) => void;
}) {
  const isUser = message.role === "user";
  const agentBadge =
    !isUser && message.agentType ? getAgentBadge(message.agentType) : null;

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
                <PersistedAttachment attachment={attachment} />
              </div>
            ))}
          </div>
        )}
        {createdTickets && createdTickets.length > 0 && (
          <TicketAccordion
            tickets={createdTickets}
            onTicketClick={onTicketClick}
          />
        )}
      </div>
    </div>
  );
}

/* ── Ticket detail drawer (lazy import) ── */

import { TicketDetailPanel } from "../board/TicketDetailPanel";

/* ── Main panel ── */

export function ChatPanel() {
  const { spaceId } = useParams();
  const { data: agentsList = [] } = useAgents(spaceId || null);
  const [selectedAgent, setSelectedAgent] = useState<string>("pm");
  const { data: messages = [], isLoading } = useChatMessages(
    spaceId || null,
    selectedAgent,
  );
  const sendMessage = useSendChatMessage(spaceId || null);
  const { data: tickets = [] } = useTickets(spaceId || null);
  const [input, setInput] = useState("");
  const AGENT_OPTIONS = useMemo(() => buildAgentOptions(agentsList), [agentsList]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<
    Array<{ file: File; url: string | null }>
  >([]);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Map of message ID -> created tickets (populated from mutation responses)
  const [ticketsByMessage, setTicketsByMessage] = useState<
    Map<string, CreatedTicketInfo[]>
  >(new Map());

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

  useEffect(() => {
    setSelectedFiles([]);
    setInput("");
  }, [spaceId, selectedAgent]);

  const handleTicketClick = useCallback((ticketId: string) => {
    setOpenTicketId(ticketId);
  }, []);

  if (!spaceId) return null;

  const handleSend = () => {
    if ((!input.trim() && selectedFiles.length === 0) || sendMessage.isPending)
      return;

    const messageText = input.trim();
    const files = [...selectedFiles];

    setInput("");
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    sendMessage.mutate(
      { message: messageText, files, agentType: selectedAgent },
      {
        onSuccess: (data) => {
          if (data?.createdTickets?.length && data.assistantMessage?.id) {
            setTicketsByMessage((prev) => {
              const next = new Map(prev);
              next.set(data.assistantMessage.id, data.createdTickets!);
              return next;
            });
          }
        },
      },
    );
  };

  const currentAgent =
    AGENT_OPTIONS.find((a) => a.value === selectedAgent) || AGENT_OPTIONS[0];

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

  const openTicket = openTicketId
    ? (tickets.find((t: Ticket) => t.id === openTicketId) ?? null)
    : null;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header with agent tabs */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Send a message to the {currentAgent.label} agent.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                createdTickets={ticketsByMessage.get(message.id)}
                onTicketClick={handleTicketClick}
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
      <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800/60">
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

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-500 dark:hover:bg-gray-800 dark:text-gray-500"
            aria-label="Attach files"
          >
            <FiPaperclip className="h-[18px] w-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileSelection}
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
              placeholder={`Message ${currentAgent.label} agent…`}
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-300 focus:bg-white focus:ring-1 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600 dark:focus:bg-gray-800"
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
              "cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
              input.trim() || selectedFiles.length > 0
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

      {/* Ticket detail drawer */}
      {openTicket && (
        <TicketDetailPanel
          ticket={openTicket}
          spaceId={spaceId}
          onClose={() => setOpenTicketId(null)}
        />
      )}
    </div>
  );
}

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AgentType } from "@/types";

export interface ChatContextValue {
  isOpen: boolean;
  selectedAgent: AgentType;
  unreadCount: number;
  openChat: (agentType?: AgentType) => void;
  closeChat: () => void;
  markRead: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("pm");
  const [unreadCount, setUnreadCount] = useState(0);

  const openChat = useCallback((agentType?: AgentType) => {
    setIsOpen(true);
    if (agentType) {
      setSelectedAgent(agentType);
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        selectedAgent,
        unreadCount,
        openChat,
        closeChat,
        markRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

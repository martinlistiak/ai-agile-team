import { FiMessageCircle } from "react-icons/fi";
import { useChatContext } from "@/contexts/ChatContext";

export function ChatBubble() {
  const { isOpen, unreadCount, openChat } = useChatContext();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => openChat()}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-24 pl-3 pr-2 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600 md:bottom-6 md:right-6"
      aria-label="Open chat"
    >
      <span className="mr-2 text-lg">Chat</span>
      <FiMessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

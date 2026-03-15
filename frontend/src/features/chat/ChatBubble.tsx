import { FiMessageCircle } from "react-icons/fi";
import { useChatContext } from "@/contexts/ChatContext";

export function ChatBubble() {
  const { isOpen, unreadCount, openChat } = useChatContext();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => openChat()}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors hover:bg-primary-600"
      aria-label="Open chat"
    >
      <FiMessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

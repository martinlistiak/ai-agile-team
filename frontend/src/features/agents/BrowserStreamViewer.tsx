import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";

interface BrowserScreenshotEvent {
  executionId: string;
  screenshot: string; // base64 JPEG
  timestamp: string;
}

interface BrowserSessionEndEvent {
  executionId: string;
  timestamp: string;
}

interface BrowserStreamViewerProps {
  agentId: string;
  isLive: boolean;
}

export function BrowserStreamViewer({
  agentId,
  isLive,
}: BrowserStreamViewerProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  const handleScreenshot = useCallback((event: BrowserScreenshotEvent) => {
    setScreenshot(event.screenshot);
    setSessionEnded(false);
  }, []);

  const handleSessionEnd = useCallback((_event: BrowserSessionEndEvent) => {
    setSessionEnded(true);
  }, []);

  // Subscribe to browser screenshot and session end events
  useEffect(() => {
    const socket = getSocket();

    socket.on("browser_screenshot", handleScreenshot);
    socket.on("browser_session_end", handleSessionEnd);

    return () => {
      socket.off("browser_screenshot", handleScreenshot);
      socket.off("browser_session_end", handleSessionEnd);
    };
  }, [agentId, handleScreenshot, handleSessionEnd]);

  // Reset state when agent changes
  useEffect(() => {
    setScreenshot(null);
    setSessionEnded(false);
  }, [agentId]);

  if (!screenshot) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-800 rounded-lg">
        {isLive ? "Waiting for browser session…" : "No active browser session"}
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <img
        src={`data:image/jpeg;base64,${screenshot}`}
        alt="Browser session"
        className="w-full h-auto block"
      />
      {sessionEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="rounded-full bg-gray-900/80 px-4 py-2 text-sm font-medium text-white">
            Session ended
          </span>
        </div>
      )}
    </div>
  );
}

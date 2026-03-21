import { useRef, useState } from "react";
import { FiCamera, FiX } from "react-icons/fi";
import { Modal } from "@/components/Modal";
import { useSendFeedback } from "@/api/hooks/useFeedback";
import { useUploadFile } from "@/api/hooks/useUploadFile";
import { cn } from "@/lib/cn";

interface FeedbackModalProps {
  onClose: () => void;
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null,
  );
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendFeedback = useSendFeedback();
  const uploadFile = useUploadFile();

  const isPending = sendFeedback.isPending || uploadFile.isPending;

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    let screenshotUrl: string | undefined;
    if (screenshotFile) {
      const uploaded = await uploadFile.mutateAsync(screenshotFile);
      screenshotUrl = uploaded.url;
    }

    await sendFeedback.mutateAsync({ message: message.trim(), screenshotUrl });
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      className="w-full max-w-lg"
      aria-label="Provide feedback"
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Provide Feedback
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Let us know what's on your mind. Bug reports, feature ideas, anything
          goes.
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your feedback…"
          rows={5}
          className="mt-4 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          autoFocus
        />

        {screenshotPreview ? (
          <div className="relative mt-3 inline-block">
            <img
              src={screenshotPreview}
              alt="Screenshot preview"
              className="max-h-32 rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={removeScreenshot}
              className="absolute -right-2 -top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
              aria-label="Remove screenshot"
            >
              <FiX size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex cursor-pointer items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiCamera size={14} />
            <span>Attach screenshot</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleScreenshot}
          className="hidden"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!message.trim() || isPending}
            className={cn(
              "cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
              !message.trim() || isPending
                ? "bg-primary-400 cursor-not-allowed opacity-60"
                : "bg-primary-600 hover:bg-primary-700",
            )}
          >
            {isPending ? "Sending…" : "Send Feedback"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

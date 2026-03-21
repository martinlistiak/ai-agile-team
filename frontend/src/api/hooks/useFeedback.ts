import { useMutation } from "@tanstack/react-query";
import api from "@/api/client";
import { useToast } from "@/components/Toast";

interface SendFeedbackPayload {
  message: string;
  screenshotUrl?: string;
}

export function useSendFeedback() {
  const { success, error: showError } = useToast();
  return useMutation({
    mutationFn: async (payload: SendFeedbackPayload) => {
      const { data } = await api.post("/notifications/feedback", payload);
      return data;
    },
    onSuccess: () => {
      success("Thanks for your feedback!");
    },
    onError: (err: Error) => {
      showError(err.message || "Failed to send feedback");
    },
  });
}
